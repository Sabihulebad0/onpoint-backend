const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const User = require("../models/User");
const { withPricing } = require("../utils/pricing");
const { evaluateCouponCode, normalizeCode } = require("../utils/coupon");
const Coupon = require("../models/Coupon");
const { hasPermission } = require("../utils/permissions");
const { buildOrderTotals, withOrderTotals } = require("../utils/orderTotals");
const { normalizeShippingAddress } = require("../utils/orderAddress");
const { notifyAdmins, notifyUser } = require("../utils/notify");
const { salesTaxForAddress } = require("../utils/usSalesTax");

const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled", "returned", "refunded"];
const LOW_STOCK_THRESHOLD = 5;

const summarizeStatus = (orders, status) => {
  const rows = orders.filter((order) => order.status === status);
  return {
    count: rows.length,
    totalAmount: rows.reduce((sum, order) => sum + Number(withOrderTotals(order).grand_total || 0), 0),
  };
};

const monthRange = (month) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthIndex] = month.split("-").map(Number);
  return {
    start: new Date(year, monthIndex - 1, 1),
    end: new Date(year, monthIndex, 1),
  };
};

const createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, shipping_address, paymentMethod = "cod", couponCode } = req.body;
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      populate: { path: "category", select: "name slug discountPercent" },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const items = [];
    const pricedItems = [];
    let itemsPrice = 0;

    for (const item of cart.items) {
      const product = item.product;
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product ? product.name : "a product"}`,
        });
      }

      const priced = withPricing(product);
      items.push({
        product: product._id,
        name: product.name,
        sku: product.sku || "",
        image: product.thumbnail || product.images?.[0] || "",
        quantity: item.quantity,
        price: priced.salePrice,
        size: item.size,
        color: item.color,
      });
      pricedItems.push({ product: priced, quantity: item.quantity, unitPrice: priced.salePrice });
      itemsPrice += priced.salePrice * item.quantity;
    }

    const requestedCode = normalizeCode(couponCode || cart.couponCode);
    let couponDiscount = 0;
    let appliedCode = "";
    let couponDoc = null;
    if (requestedCode) {
      const result = await evaluateCouponCode(requestedCode, pricedItems);
      if (result.error) {
        return res.status(400).json({ message: result.error });
      }
      couponDiscount = result.discount || 0;
      appliedCode = requestedCode;
      couponDoc = result.coupon;
    }

    const shippingPrice = itemsPrice >= 100 ? 0 : 8;
    const shipping = normalizeShippingAddress(
      { ...(shippingAddress || {}), ...(shipping_address || {}) },
      req.user.name
    );
    if (!shipping.address_line1 || !shipping.city || !shipping.postal_code || !shipping.country_code) {
      return res.status(400).json({ message: "Complete shipping address is required" });
    }
    if (shipping.country_code === "US" && !salesTaxForAddress(shipping).code) {
      return res.status(400).json({ message: "Enter a valid US state so sales tax can be calculated" });
    }
    const tax = salesTaxForAddress(shipping);
    const totals = buildOrderTotals({
      subtotal: itemsPrice,
      shipping_total: shippingPrice,
      discount_total: couponDiscount,
      taxRate: tax.rate,
      currency: req.body.currency || process.env.CURRENCY,
    });
    const totalPrice = totals.grand_total;
    const phone = shippingAddress?.phone || shipping_address?.phone || req.user.phone || "";

    const order = await Order.create({
      user: req.user._id,
      items,
      shipping_address: shipping,
      shippingAddress: {
        street: shipping.address_line1,
        city: shipping.city,
        state: shipping.state_province,
        postalCode: shipping.postal_code,
        country: shipping.country_code,
        phone,
      },
      paymentMethod,
      itemsPrice,
      couponCode: appliedCode,
      couponDiscount,
      shippingPrice,
      totalPrice,
      ...totals,
      taxRate: tax.rate,
      taxState: tax.code,
      trackingId: `TRK${Date.now().toString(36).toUpperCase()}`,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: phone,
    });

    if (couponDoc) {
      await Coupon.findByIdAndUpdate(couponDoc._id, { $inc: { usedCount: 1 } });
    }

    for (const item of cart.items) {
      const updated = await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (updated && updated.stock <= LOW_STOCK_THRESHOLD) {
        await notifyAdmins({
          title: `Low stock: ${updated.name}`,
          message: `Only ${updated.stock} left in stock.`,
          type: "product",
          link: `/products/${updated._id}`,
          meta: { productId: updated._id, stock: updated.stock },
        });
      }
    }

    cart.items = [];
    cart.couponCode = "";
    await cart.save();

    await notifyAdmins({
      title: `New order from ${req.user.name}`,
      message: `${items.length} item(s) for ${totals.currency || ""} ${totalPrice.toFixed(2)} via ${paymentMethod}.`.trim(),
      type: "order",
      link: `/orders/${order._id}`,
      meta: { orderId: order._id, totalPrice },
    });

    res.status(201).json(withOrderTotals(order));
  } catch (error) {
    next(error);
  }
};

const quoteOrder = async (req, res, next) => {
  try {
    const { shippingAddress, shipping_address, couponCode } = req.body || {};
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      populate: { path: "category", select: "name slug discountPercent" },
    });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const pricedItems = [];
    let itemsPrice = 0;
    for (const item of cart.items) {
      const product = item.product;
      if (!product) continue;
      const priced = withPricing(product);
      pricedItems.push({ product: priced, quantity: item.quantity, unitPrice: priced.salePrice });
      itemsPrice += priced.salePrice * item.quantity;
    }

    const requestedCode = normalizeCode(couponCode || cart.couponCode);
    let couponDiscount = 0;
    let appliedCode = "";
    if (requestedCode) {
      const result = await evaluateCouponCode(requestedCode, pricedItems);
      if (!result.error) {
        couponDiscount = result.discount || 0;
        appliedCode = requestedCode;
      }
    }

    const shippingPrice = itemsPrice >= 100 ? 0 : 8;
    const shipping = normalizeShippingAddress(
      { ...(shippingAddress || {}), ...(shipping_address || {}) },
      req.user.name
    );
    const tax = salesTaxForAddress(shipping);
    const totals = buildOrderTotals({
      subtotal: itemsPrice,
      shipping_total: shippingPrice,
      discount_total: couponDiscount,
      taxRate: tax.rate,
      currency: req.body?.currency || process.env.CURRENCY,
    });

    res.json({
      ...totals,
      couponCode: appliedCode,
      taxRate: tax.rate,
      taxState: tax.code,
      taxStateName: tax.name,
      shipping_address: shipping,
    });
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("items.product", "name sku thumbnail images")
      .sort({ createdAt: -1 });
    res.json(orders.map(withOrderTotals));
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const { month, search, status } = req.query;
    const filter = {};
    const range = monthRange(month);
    if (range) {
      filter.createdAt = { $gte: range.start, $lt: range.end };
    }

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = filter.createdAt || {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (req.query.method === "card") filter.paymentMethod = "card";
    if (req.query.method === "cash" || req.query.method === "cod") filter.paymentMethod = "cod";

    if (search && String(search).trim()) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      const users = await User.find({
        $or: [{ name: rx }, { email: rx }, { phone: rx }],
      }).select("_id");

      filter.$or = [
        { user: { $in: users.map((user) => user._id) } },
        { customerName: rx },
        { customerEmail: rx },
        { customerPhone: rx },
        { "shippingAddress.phone": rx },
        { couponCode: rx },
      ];
    }

    const allOrders = await Order.find(filter)
      .populate("user", "name email phone role")
      .populate("assignedTo", "name email phone")
      .populate("items.product", "name sku thumbnail images")
      .sort({ createdAt: -1 });

    const summaries = {
      cancelled: summarizeStatus(allOrders, "cancelled"),
      returned: summarizeStatus(allOrders, "returned"),
      refunded: summarizeStatus(allOrders, "refunded"),
    };

    const statusFilter = ORDER_STATUSES.includes(status) ? status : "";
    const mapped = allOrders.map(withOrderTotals);
    const orders = statusFilter ? mapped.filter((order) => order.status === statusFilter) : mapped;
    const totalAmount = orders.reduce((sum, order) => sum + Number(order.grand_total || order.totalPrice || 0), 0);

    res.json({
      orders,
      count: orders.length,
      totalAmount,
      month: month || null,
      search: search || "",
      status: statusFilter || null,
      summaries,
    });
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email phone role")
      .populate("assignedTo", "name email phone")
      .populate("items.product", "name sku thumbnail images");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const ownerId = order.user?._id || order.user;
    const isOwner = String(ownerId) === String(req.user._id);
    if (!isOwner && !hasPermission(req.user, "orders:read")) {
      return res.status(403).json({ message: "You do not have permission for this action" });
    }
    res.json(withOrderTotals(order));
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    order.status = status;
    order.statusHistory.push({ status, at: new Date(), by: req.user._id });
    if (!order.trackingId) {
      order.trackingId = `TRK${String(order._id).slice(-10).toUpperCase()}`;
    }
    if (status === "delivered" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }
    await order.save();
    await order.populate("user", "name email phone role");
    await order.populate("assignedTo", "name email phone");
    await order.populate("items.product", "name sku thumbnail images");

    const ownerId = order.user?._id || order.user;
    await notifyUser(ownerId, {
      title: `Order ${status}`,
      message: `Your order #${String(order._id).slice(-6).toUpperCase()} is now ${status}.`,
      type: "order",
      link: `/orders/${order._id}`,
      meta: { orderId: order._id, status },
      createdBy: req.user._id,
    });

    res.json(withOrderTotals(order));
  } catch (error) {
    next(error);
  }
};

const validIds = (ids) =>
  (Array.isArray(ids) ? ids : []).filter((id) => mongoose.Types.ObjectId.isValid(id));

const populatedOrder = (query) =>
  query
    .populate("user", "name email phone role")
    .populate("assignedTo", "name email phone")
    .populate("items.product", "name sku thumbnail images");

const listCouriers = async (req, res, next) => {
  try {
    const users = await User.find({ role: "delivery", isActive: { $ne: false } })
      .select("name email phone")
      .sort({ name: 1 });
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

const assignOrder = async (req, res, next) => {
  try {
    const courierId = req.body.userId;
    if (!mongoose.Types.ObjectId.isValid(courierId)) {
      return res.status(400).json({ message: "Select a delivery person" });
    }
    const courier = await User.findById(courierId);
    if (!courier || courier.role !== "delivery") {
      return res.status(400).json({ message: "That account is not a delivery user" });
    }
    const order = await populatedOrder(
      Order.findByIdAndUpdate(req.params.id, { assignedTo: courier._id }, { new: true })
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(withOrderTotals(order));
  } catch (error) {
    next(error);
  }
};

const unassignOrder = async (req, res, next) => {
  try {
    const order = await populatedOrder(
      Order.findByIdAndUpdate(req.params.id, { assignedTo: null }, { new: true })
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(withOrderTotals(order));
  } catch (error) {
    next(error);
  }
};

const bulkAssignOrders = async (req, res, next) => {
  try {
    const ids = validIds(req.body.ids);
    const courierId = req.body.userId;
    if (!ids.length) return res.status(400).json({ message: "Select at least one order" });
    if (!mongoose.Types.ObjectId.isValid(courierId)) {
      return res.status(400).json({ message: "Select a delivery person" });
    }
    const courier = await User.findById(courierId);
    if (!courier || courier.role !== "delivery") {
      return res.status(400).json({ message: "That account is not a delivery user" });
    }
    const result = await Order.updateMany({ _id: { $in: ids } }, { assignedTo: courier._id });
    res.json({ updated: result.modifiedCount || 0 });
  } catch (error) {
    next(error);
  }
};

const bulkUnassignOrders = async (req, res, next) => {
  try {
    const ids = validIds(req.body.ids);
    if (!ids.length) return res.status(400).json({ message: "Select at least one order" });
    const result = await Order.updateMany({ _id: { $in: ids } }, { assignedTo: null });
    res.json({ updated: result.modifiedCount || 0 });
  } catch (error) {
    next(error);
  }
};

const bulkDeleteOrders = async (req, res, next) => {
  try {
    const ids = validIds(req.body.ids);
    if (!ids.length) return res.status(400).json({ message: "Select at least one order" });
    const result = await Order.deleteMany({ _id: { $in: ids } });
    res.json({ removed: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  quoteOrder,
  getMyOrders,
  getOrders,
  getOrder,
  updateOrderStatus,
  listCouriers,
  assignOrder,
  unassignOrder,
  bulkAssignOrders,
  bulkUnassignOrders,
  bulkDeleteOrders,
};
