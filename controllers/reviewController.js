const mongoose = require("mongoose");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

const publicReview = (review) => ({
  _id: review._id,
  product: review.product,
  rating: review.rating,
  comment: review.comment || "",
  name: review.name || "Customer",
  createdAt: review.createdAt,
  user: review.user?._id || review.user,
  verified: Boolean(review.verified),
});

const ratingsMap = async (ids = []) => {
  const objectIds = ids
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (!objectIds.length) return {};
  const rows = await Review.aggregate([
    { $match: { product: { $in: objectIds } } },
    { $group: { _id: "$product", ratingAvg: { $avg: "$rating" }, ratingCount: { $sum: 1 } } },
  ]);
  const map = {};
  for (const row of rows) {
    map[String(row._id)] = {
      ratingAvg: Math.round(Number(row.ratingAvg || 0) * 10) / 10,
      ratingCount: Number(row.ratingCount || 0),
    };
  }
  return map;
};

const attachRatings = async (products) => {
  const list = Array.isArray(products) ? products : products ? [products] : [];
  const map = await ratingsMap(list.map((item) => item?._id || item?.id).filter(Boolean));
  const withStats = (item) => {
    const obj = item && typeof item === "object" ? item : {};
    const stats = map[String(obj._id || "")] || { ratingAvg: 0, ratingCount: 0 };
    return { ...obj, ratingAvg: stats.ratingAvg, ratingCount: stats.ratingCount };
  };
  if (Array.isArray(products)) return list.map(withStats);
  return products ? withStats(products) : products;
};

const getProductReviews = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Product not found" });
    }
    const product = await Product.findById(id).select("_id");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    const reviews = await Review.find({ product: id }).sort({ createdAt: -1 }).limit(100);
    const stats = (await ratingsMap([id]))[id] || { ratingAvg: 0, ratingCount: 0 };
    res.json({
      ...stats,
      reviews: reviews.map(publicReview),
    });
  } catch (error) {
    next(error);
  }
};

const upsertProductReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    const product = await Product.findById(id).select("_id name");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const purchased = await Order.exists({
      user: req.user._id,
      "items.product": product._id,
      status: { $in: ["paid", "shipped", "delivered"] },
    });

    const review = await Review.findOneAndUpdate(
      { product: product._id, user: req.user._id },
      {
        product: product._id,
        user: req.user._id,
        rating: Math.round(rating),
        comment,
        name: req.user.name || "Customer",
        verified: Boolean(purchased),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const stats = (await ratingsMap([id]))[id] || { ratingAvg: review.rating, ratingCount: 1 };
    res.status(201).json({
      ...stats,
      review: publicReview(review),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { attachRatings, getProductReviews, upsertProductReview };
