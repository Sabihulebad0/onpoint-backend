const mongoose = require("mongoose");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const { parseCouponFields, upsertScopedCoupon, couponsForTarget } = require("../utils/coupon");
const { parseType } = require("../utils/itemType");
const { saveImage } = require("../config/storage");

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const parseDiscount = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.min(100, amount);
};

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === "true" || value === "on" || value === "1";
};

const parseParent = (value) => {
  if (!value || value === "null" || value === "none") return null;
  return mongoose.Types.ObjectId.isValid(value) ? value : null;
};

const resolveIcon = async (req, fallback = "") => {
  if (req.file) return saveImage(req.file, "categories");
  if (req.body.icon !== undefined) return String(req.body.icon || "");
  return fallback;
};

const getCategories = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.includeInactive !== "true") filter.isActive = { $ne: false };
    const type = parseType(req.query.type, "");
    if (type) filter.type = type;
    const [categories, grouped, coupons] = await Promise.all([
      Category.find(filter).sort({ type: 1, name: 1 }).lean(),
      Product.aggregate([
        { $group: { _id: { $toString: "$category" }, count: { $sum: 1 } } },
      ]),
      Coupon.find({ isActive: true }).select("code type amount appliesTo categories products"),
    ]);
    const counts = Object.fromEntries(grouped.map((row) => [String(row._id), row.count]));
    res.json(
      categories.map((category) => ({
        ...category,
        productCount: counts[String(category._id)] || 0,
        coupons: coupons.filter(
          (coupon) =>
            coupon.appliesTo === "all" ||
            (coupon.categories || []).some((id) => String(id) === String(category._id))
        ),
      }))
    );
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description, discountPercent } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = await Category.create({
      name,
      slug: slugify(name),
      description: description || "",
      icon: await resolveIcon(req),
      parent: parseParent(req.body.parent),
      type: parseType(req.body.type),
      isActive: parseBoolean(req.body.isActive, true),
      discountPercent: parseDiscount(discountPercent),
    });
    const couponInput = parseCouponFields(req.body);
    if (couponInput) {
      await upsertScopedCoupon({ ...couponInput, appliesTo: "category", categoryId: category._id });
    }
    const coupons = await couponsForTarget({ categoryId: category._id });
    res.status(201).json({ ...category.toObject(), coupons });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { name, description, discountPercent } = req.body;
    const updates = {};
    if (name) {
      updates.name = name;
      updates.slug = slugify(name);
    }
    if (description !== undefined) updates.description = description;
    if (discountPercent !== undefined) updates.discountPercent = parseDiscount(discountPercent);
    if (req.file || req.body.icon !== undefined) updates.icon = await resolveIcon(req);
    if (req.body.isActive !== undefined) updates.isActive = parseBoolean(req.body.isActive, true);
    if (req.body.type !== undefined) updates.type = parseType(req.body.type);
    if (req.body.parent !== undefined) {
      const parent = parseParent(req.body.parent);
      if (parent && String(parent) === String(req.params.id)) {
        return res.status(400).json({ message: "A category cannot be its own parent" });
      }
      updates.parent = parent;
    }

    const category = await Category.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const couponInput = parseCouponFields(req.body);
    if (couponInput) {
      await upsertScopedCoupon({ ...couponInput, appliesTo: "category", categoryId: category._id });
    }
    const coupons = await couponsForTarget({ categoryId: category._id });
    res.json({ ...category.toObject(), coupons });
  } catch (error) {
    next(error);
  }
};

const getCategory = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Category not found" });
    }
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const productCount = await Product.countDocuments({ category: category._id });
    const coupons = await couponsForTarget({ categoryId: category._id });
    res.json({ ...category.toObject(), productCount, coupons });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const productCount = await Product.countDocuments({ category: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        message: `Cannot delete this category while ${productCount} product(s) still use it`,
      });
    }
    await category.deleteOne();
    await Category.updateMany({ parent: category._id }, { parent: null });
    res.json({ message: "Category removed" });
  } catch (error) {
    next(error);
  }
};

const patchCategoryStatus = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    category.isActive = parseBoolean(req.body.isActive, !category.isActive);
    await category.save();
    res.json(category);
  } catch (error) {
    next(error);
  }
};

const bulkDeleteCategories = async (req, res, next) => {
  try {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (!ids.length) {
      return res.status(400).json({ message: "Select at least one category" });
    }

    // Categories still holding products are skipped rather than failing the whole batch.
    const inUse = await Product.aggregate([
      { $match: { category: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: "$category" } },
    ]);
    const blocked = new Set(inUse.map((row) => String(row._id)));
    const removable = ids.filter((id) => !blocked.has(String(id)));

    const result = removable.length
      ? await Category.deleteMany({ _id: { $in: removable } })
      : { deletedCount: 0 };
    if (removable.length) {
      await Category.updateMany({ parent: { $in: removable } }, { parent: null });
    }

    res.json({ removed: result.deletedCount || 0, skipped: blocked.size });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  patchCategoryStatus,
  bulkDeleteCategories,
};
