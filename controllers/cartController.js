const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { withPricing } = require("../utils/pricing");
const { evaluateCouponCode, normalizeCode } = require("../utils/coupon");

const productPopulate = { path: "items.product", populate: { path: "category", select: "name slug discountPercent" } };

const pricedItemsFromCart = (cart) =>
  (cart.items || [])
    .filter((item) => item.product)
    .map((item) => {
      const product = withPricing(item.product);
      return {
        product,
        quantity: item.quantity,
        unitPrice: product.salePrice,
        size: item.size,
        color: item.color,
      };
    });

const withCartPricing = async (cart) => {
  if (!cart) return { user: null, items: [], itemsPrice: 0, couponCode: "", couponDiscount: 0, shippingPrice: 0, totalPrice: 0 };
  const data = cart.toObject ? cart.toObject() : cart;
  const pricedItems = pricedItemsFromCart(data);
  data.items = pricedItems.map((item) => ({
    product: item.product,
    quantity: item.quantity,
    size: item.size,
    color: item.color,
  }));
  const itemsPrice = Number(
    pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)
  );
  let couponDiscount = 0;
  let coupon = null;
  let couponError = null;
  if (data.couponCode) {
    const result = await evaluateCouponCode(data.couponCode, pricedItems);
    if (result.error) {
      couponError = result.error;
    } else {
      couponDiscount = result.discount || 0;
      coupon = result.coupon;
    }
  }
  const shippingPrice = itemsPrice >= 100 ? 0 : itemsPrice > 0 ? 8 : 0;
  const totalPrice = Number((Math.max(0, itemsPrice - couponDiscount) + shippingPrice).toFixed(2));
  return {
    ...data,
    itemsPrice,
    couponCode: data.couponCode || "",
    couponDiscount,
    coupon,
    couponError,
    shippingPrice,
    totalPrice,
  };
};

const loadCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate(productPopulate);
  return withCartPricing(cart || { user: userId, items: [], couponCode: "" });
};

const getCart = async (req, res, next) => {
  try {
    res.json(await loadCart(req.user._id));
  } catch (error) {
    next(error);
  }
};

const addToCart = async (req, res, next) => {
  try {
    const productId = String(req.body.productId || req.body.product || "").trim();
    const qty = Number(req.body.quantity ?? 1);
    const size = String(req.body.size || "").trim();
    const color = String(req.body.color || "").trim();

    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ message: "quantity must be at least 1" });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }

    const sizes = (product.sizes || []).map((value) => String(value).trim()).filter(Boolean);
    const colors = (product.colors || []).map((value) => String(value).trim()).filter(Boolean);
    const resolvedSize = size || sizes[0] || "";
    const resolvedColor = color || colors[0] || "";
    if (sizes.length && !sizes.includes(resolvedSize)) {
      return res.status(400).json({ message: "Select a valid size" });
    }
    if (colors.length && !colors.includes(resolvedColor)) {
      return res.status(400).json({ message: "Select a valid color" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const existing = cart.items.find(
      (item) =>
        item.product.toString() === productId &&
        (item.size || "") === resolvedSize &&
        (item.color || "") === resolvedColor
    );

    const nextQty = (existing ? existing.quantity : 0) + Math.floor(qty);
    if (product.stock != null && nextQty > Number(product.stock)) {
      return res.status(400).json({ message: "Not enough stock for this product" });
    }

    if (existing) {
      existing.quantity = nextQty;
    } else {
      cart.items.push({ product: productId, quantity: Math.floor(qty), size: resolvedSize, color: resolvedColor });
    }

    await cart.save();
    await cart.populate(productPopulate);
    res.status(existing ? 200 : 201).json(await withCartPricing(cart));
  } catch (error) {
    next(error);
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const { productId, quantity, size, color } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.find(
      (entry) =>
        entry.product.toString() === productId &&
        (entry.size || "") === (size || "") &&
        (entry.color || "") === (color || "")
    );

    if (!item) {
      return res.status(404).json({ message: "Item not in cart" });
    }

    if (Number(quantity) <= 0) {
      cart.items = cart.items.filter((entry) => entry !== item);
    } else {
      item.quantity = Number(quantity);
    }

    await cart.save();
    await cart.populate(productPopulate);
    res.json(await withCartPricing(cart));
  } catch (error) {
    next(error);
  }
};

const removeCartItem = async (req, res, next) => {
  try {
    const productId = String(req.body.productId || req.body.product || "").trim();
    const size = String(req.body.size || "").trim();
    const color = String(req.body.color || "").trim();
    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const before = cart.items.length;
    cart.items = cart.items.filter(
      (entry) =>
        !(
          entry.product.toString() === productId &&
          (entry.size || "") === size &&
          (entry.color || "") === color
        )
    );
    if (cart.items.length === before) {
      return res.status(404).json({ message: "Item not in cart" });
    }
    if (cart.items.length === 0) cart.couponCode = "";

    await cart.save();
    await cart.populate(productPopulate);
    res.json(await withCartPricing(cart));
  } catch (error) {
    next(error);
  }
};

const applyCoupon = async (req, res, next) => {
  try {
    const code = normalizeCode(req.body.code || req.body.couponCode);
    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }
    let cart = await Cart.findOne({ user: req.user._id }).populate(productPopulate);
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Add items to the cart before applying a coupon" });
    }
    const result = await evaluateCouponCode(code, pricedItemsFromCart(cart));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    cart.couponCode = code;
    await cart.save();
    await cart.populate(productPopulate);
    res.json(await withCartPricing(cart));
  } catch (error) {
    next(error);
  }
};

const removeCoupon = async (req, res, next) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { couponCode: "" },
      { new: true }
    ).populate(productPopulate);
    res.json(await withCartPricing(cart || { user: req.user._id, items: [], couponCode: "" }));
  } catch (error) {
    next(error);
  }
};

const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], couponCode: "" },
      { new: true }
    );
    res.json(await withCartPricing(cart || { user: req.user._id, items: [], couponCode: "" }));
  } catch (error) {
    next(error);
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, applyCoupon, removeCoupon, clearCart };
