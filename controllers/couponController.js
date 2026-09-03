const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");
const { normalizeCode } = require("../utils/coupon");
const { saveImage } = require("../config/storage");

const asIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildPayload = (body) => {
  const code = normalizeCode(body.code);
  if (!code) {
    const error = new Error("Coupon code is required");
    error.statusCode = 400;
    throw error;
  }
  const type = body.type === "fixed" ? "fixed" : "percent";
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Coupon amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }
  if (type === "percent" && amount > 100) {
    const error = new Error("Percent coupons cannot exceed 100");
    error.statusCode = 400;
    throw error;
  }
  const appliesTo = ["all", "category", "product"].includes(body.appliesTo) ? body.appliesTo : "all";
  return {
    code,
    name: body.name || "",
    description: body.description || "",
    type,
    amount,
    appliesTo,
    products: appliesTo === "product" ? asIds(body.products) : [],
    categories: appliesTo === "category" ? asIds(body.categories) : [],
    minOrderAmount: Number(body.minOrderAmount || 0),
    maxDiscount: Number(body.maxDiscount || 0),
    usageLimit: Number(body.usageLimit || 0),
    startsAt: body.startsAt ? body.startsAt : null,
    expiresAt: body.expiresAt ? body.expiresAt : null,
    isActive: body.isActive !== false && body.isActive !== "false",
  };
};

const listCoupons = async (req, res, next) => {
  try {
    const { product, category, code } = req.query;
    const filter = {};
    if (code) filter.code = new RegExp(String(code).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (product) filter.$or = [{ appliesTo: "all" }, { products: product }];
    if (category) filter.$or = [{ appliesTo: "all" }, { categories: category }];
    const coupons = await Coupon.find(filter)
      .populate("products", "name")
      .populate("categories", "name")
      .sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    next(error);
  }
};

const getCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate("products", "name")
      .populate("categories", "name");
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (error) {
    next(error);
  }
};

const resolveImage = async (req) => {
  if (req.file) return saveImage(req.file, "coupons");
  if (req.body.image !== undefined) return String(req.body.image || "");
  return undefined;
};

const createCoupon = async (req, res, next) => {
  try {
    const payload = buildPayload(req.body);
    const image = await resolveImage(req);
    const coupon = await Coupon.create({ ...payload, image: image || "" });
    res.status(201).json(coupon);
  } catch (error) {
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const payload = buildPayload(req.body);
    const image = await resolveImage(req);
    if (image !== undefined) payload.image = image;
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (error) {
    next(error);
  }
};

const patchCouponStatus = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    const { isActive } = req.body;
    coupon.isActive =
      isActive === undefined ? !coupon.isActive : isActive === true || isActive === "true";
    await coupon.save();
    res.json(coupon);
  } catch (error) {
    next(error);
  }
};

const bulkDeleteCoupons = async (req, res, next) => {
  try {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (!ids.length) return res.status(400).json({ message: "Select at least one coupon" });
    const result = await Coupon.deleteMany({ _id: { $in: ids } });
    res.json({ removed: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json({ message: "Coupon removed" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  patchCouponStatus,
  bulkDeleteCoupons,
};
