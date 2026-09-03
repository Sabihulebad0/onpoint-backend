const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const { hasPermission } = require("../utils/permissions");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const search = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const type = req.query.type || "all";
    const limit = Math.min(Number(req.query.limit) || 8, 25);

    if (q.length < 1) {
      return res.status(400).json({ message: "Query parameter q is required" });
    }

    const rx = new RegExp(escapeRegex(q), "i");
    const result = { q, products: [], categories: [], orders: [], users: [], coupons: [] };

    const tasks = [];

    if (type === "all" || type === "products") {
      tasks.push(
        Product.find({
          $or: [{ name: rx }, { description: rx }, { sport: rx }, { brand: rx }],
        })
          .populate("category", "name slug")
          .limit(limit)
          .then((items) => {
            result.products = items;
          })
      );
    }

    if (type === "all" || type === "categories") {
      tasks.push(
        Category.find({ $or: [{ name: rx }, { slug: rx }, { description: rx }] })
          .limit(limit)
          .then((items) => {
            result.categories = items;
          })
      );
    }

    if ((type === "all" || type === "orders") && hasPermission(req.user, "orders:read")) {
      tasks.push(
        Order.find({
          $or: [{ "items.name": rx }, { status: rx }, { paymentMethod: rx }, { couponCode: rx }],
        })
          .populate("user", "name email")
          .limit(limit)
          .then((items) => {
            result.orders = items;
          })
      );
    }

    if ((type === "all" || type === "users") && hasPermission(req.user, "users:manage")) {
      tasks.push(
        User.find({ $or: [{ name: rx }, { email: rx }, { role: rx }] })
          .limit(limit)
          .then((items) => {
            result.users = items.map((user) => ({
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              isActive: user.isActive,
            }));
          })
      );
    }

    if (type === "all" || type === "coupons") {
      tasks.push(
        Coupon.find({ $or: [{ code: rx }, { description: rx }] })
          .limit(limit)
          .then((items) => {
            result.coupons = items;
          })
      );
    }

    await Promise.all(tasks);

    result.total =
      result.products.length +
      result.categories.length +
      result.orders.length +
      result.users.length +
      result.coupons.length;

    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { search };
