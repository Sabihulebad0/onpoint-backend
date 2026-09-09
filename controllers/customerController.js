const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { publicCustomer, publicAddress, upsertCustomer, normEmail } = require("../utils/customer");
const { withOrderTotals } = require("../utils/orderTotals");
const { withShippingAddress } = require("../utils/orderAddress");

const listCustomers = async (req, res, next) => {
  try {
    const { search, type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type === "login" || type === "guest") filter.type = type;
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Customer.countDocuments(filter),
    ]);

    let countMap = new Map();
    if (customers.length) {
      const emails = customers.map((item) => item.email);
      const userIds = customers.map((item) => item.user).filter(Boolean);
      const match = [{ customerEmail: { $in: emails } }];
      if (userIds.length) match.push({ user: { $in: userIds } });
      const counts = await Order.aggregate([
        { $match: { $or: match } },
        { $group: { _id: { $toLower: { $ifNull: ["$customerEmail", ""] } }, count: { $sum: 1 } } },
      ]);
      countMap = new Map(counts.map((row) => [String(row._id), row.count]));
    }

    res.json({
      customers: customers.map((item) =>
        publicCustomer(item, { orderCount: countMap.get(String(item.email).toLowerCase()) || 0 })
      ),
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
    });
  } catch (error) {
    next(error);
  }
};

const getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    const orderCount = await Order.countDocuments({
      $or: [{ customerEmail: customer.email }, customer.user ? { user: customer.user } : { _id: null }],
    });
    res.json({ customer: publicCustomer(customer, { orderCount }) });
  } catch (error) {
    next(error);
  }
};

const getCustomerOrders = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    const filter = {
      $or: [{ customerEmail: customer.email }, ...(customer.user ? [{ user: customer.user }] : [])],
    };
    const orders = await Order.find(filter).sort({ createdAt: -1 }).populate("user", "name email phone");
    res.json({
      customer: publicCustomer(customer),
      orders: orders.map((order) => withOrderTotals(withShippingAddress(order.toObject()))),
    });
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    const { name, email, phone, isActive } = req.body;
    if (name) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (email) {
      const nextEmail = normEmail(email);
      const taken = await Customer.findOne({ email: nextEmail, _id: { $ne: customer._id } });
      if (taken) return res.status(409).json({ message: "Email already used by another customer" });
      customer.email = nextEmail;
    }
    if (typeof isActive === "boolean") customer.isActive = isActive;
    await customer.save();
    res.json({ customer: publicCustomer(customer), message: "Customer updated" });
  } catch (error) {
    next(error);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normEmail(req.body.email);
    const phone = String(req.body.phone || "").trim();
    const type = req.body.type === "login" ? "login" : "guest";
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    const exists = await Customer.findOne({ email });
    if (exists) return res.status(409).json({ message: "Customer already exists" });
    const customer = await upsertCustomer({ name, email, phone, type });
    res.status(201).json({ customer: publicCustomer(customer) });
  } catch (error) {
    next(error);
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    await customer.deleteOne();
    res.json({ message: "Customer removed" });
  } catch (error) {
    next(error);
  }
};

const bulkDeleteCustomers = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ message: "Select customers to delete" });
    const result = await Customer.deleteMany({ _id: { $in: ids } });
    res.json({ message: "Customers removed", deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCustomers,
  getCustomer,
  getCustomerOrders,
  updateCustomer,
  createCustomer,
  deleteCustomer,
  bulkDeleteCustomers,
};
