const Product = require("../models/Product");
const { saveImage, storageMode } = require("../config/storage");
const { withPricing } = require("../utils/pricing");
const { parseCouponFields, upsertScopedCoupon, couponsForTarget } = require("../utils/coupon");

const parseDiscount = (value, fallback = null) => {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.min(100, amount);
};

const parseList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (error) {
    // comma-separated fallback
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === "true" || value === "on" || value === "1";
};

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const parseNumber = (value, fallback = 0) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "" || raw === undefined || raw === null) return fallback;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : fallback;
};

const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseVariants = (input) => {
  const raw = parseJson(input, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((variant) => ({
      options: (Array.isArray(variant.options) ? variant.options : [])
        .map((option) => ({
          attribute: option.attribute || undefined,
          attributeTitle: String(option.attributeTitle || "").trim(),
          valueId: option.valueId || undefined,
          value: String(option.value || "").trim(),
        }))
        .filter((option) => option.value),
      sku: String(variant.sku || "").trim(),
      barcode: String(variant.barcode || "").trim(),
      price: parseNumber(variant.price, 0),
      salePrice: parseNumber(variant.salePrice, 0),
      stock: parseNumber(variant.stock, 0),
      image: String(variant.image || "").trim(),
      isActive: parseBoolean(variant.isActive, true),
    }))
    .filter((variant) => variant.options.length > 0);
};

const parseSeo = (body, existing = {}) => {
  const fromJson = parseJson(body.seo, {}) || {};
  const current = existing.seo || {};
  return {
    title: String(firstPresent(fromJson.title, body.seoTitle, current.title) || ""),
    description: String(firstPresent(fromJson.description, body.seoDescription, current.description) || ""),
    keywords: String(firstPresent(fromJson.keywords, body.seoKeywords, current.keywords) || ""),
  };
};

const parseDimensions = (body, existing = {}) => {
  let fromJson = {};
  if (body.dimensions) {
    try {
      fromJson = typeof body.dimensions === "string" ? JSON.parse(body.dimensions) : body.dimensions;
    } catch (error) {
      fromJson = {};
    }
  }
  return {
    weight: parseNumber(firstPresent(fromJson.weight, body.weight, body.productWeight, existing.weight), 0),
    volume: parseNumber(firstPresent(fromJson.volume, body.volume, body.productVolume, existing.volume), 0),
    width: parseNumber(firstPresent(fromJson.width, body.width, body.productWidth, existing.width), 0),
    height: parseNumber(firstPresent(fromJson.height, body.height, body.productHeight, existing.height), 0),
  };
};

const buildPayload = async (req, existing = {}) => {
  const thumbnailFile = req.files?.thumbnail?.[0];
  const galleryFiles = req.files?.images || [];

  let thumbnail = req.body.existingThumbnail || existing.thumbnail || "";
  if (thumbnailFile) {
    thumbnail = await saveImage(thumbnailFile);
  }

  let images = parseList(req.body.existingImages);
  if (!images.length && !galleryFiles.length) {
    images = existing.images || [];
  }
  for (const file of galleryFiles) {
    const url = await saveImage(file);
    if (url) images.push(url);
  }

  if (!thumbnail && images[0]) thumbnail = images[0];

  const dimensions = parseDimensions(req.body, existing);

  const hasVariants = parseBoolean(req.body.hasVariants, Boolean(existing.hasVariants));
  const variants =
    req.body.variants === undefined ? existing.variants || [] : parseVariants(req.body.variants);
  const attributes =
    req.body.attributes === undefined ? existing.attributes || [] : parseList(req.body.attributes);
  // With variants on, the product-level stock is the roll-up of its combinations.
  const stock =
    hasVariants && variants.length
      ? variants.reduce((total, variant) => total + Number(variant.stock || 0), 0)
      : Number(req.body.stock || 0);

  return {
    name: req.body.name,
    sku: (req.body.sku || "").toString().trim().toUpperCase(),
    barcode: (req.body.barcode || "").toString().trim(),
    slug: slugify(req.body.slug || req.body.name || existing.slug),
    tags: parseList(req.body.tags),
    hasVariants,
    attributes,
    variants,
    seo: parseSeo(req.body, existing),
    shortDescription: req.body.shortDescription || "",
    description: req.body.description,
    sport: req.body.sport,
    brand: req.body.brand || "",
    category: req.body.category,
    price: Number(req.body.price),
    discountPercent: parseDiscount(req.body.discountPercent, existing.discountPercent ?? null),
    compareAtPrice: req.body.compareAtPrice === "" || req.body.compareAtPrice == null
      ? undefined
      : Number(req.body.compareAtPrice),
    stock,
    weight: dimensions.weight,
    volume: dimensions.volume,
    width: dimensions.width,
    height: dimensions.height,
    sizes: parseList(req.body.sizes),
    colors: parseList(req.body.colors),
    featured: parseBoolean(req.body.featured),
    isActive: parseBoolean(req.body.isActive, true),
    thumbnail,
    images,
    storage: storageMode(),
  };
};

const productSearchFilter = (q) => {
  const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(escaped, "i");
  return {
    $or: [
      { name: rx },
      { sku: rx },
      { shortDescription: rx },
      { description: rx },
      { sport: rx },
      { brand: rx },
      { sizes: rx },
      { colors: rx },
    ],
  };
};

const searchProducts = async (req, res, next) => {
  try {
    const q = (req.query.q || req.query.search || "").trim();
    const includeInactive = req.query.includeInactive === "true";
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    if (!q) {
      return res.status(400).json({ message: "Query parameter q is required" });
    }

    const filter = { ...productSearchFilter(q) };
    if (!includeInactive) filter.isActive = true;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug discountPercent")
        .sort({ createdAt: -1 })
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({
      q,
      products: products.map(withPricing),
      total,
    });
  } catch (error) {
    next(error);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const {
      sport,
      category,
      featured,
      search,
      page = 1,
      limit = 12,
      includeInactive,
      minPrice,
      maxPrice,
      status,
    } = req.query;
    const filter = {};
    if (includeInactive !== "true") filter.isActive = true;

    if (sport) filter.sport = new RegExp(`^${sport}$`, "i");
    if (category) filter.category = category;
    if (featured === "true") filter.featured = true;
    if (featured === "false") filter.featured = false;
    if (search) Object.assign(filter, productSearchFilter(search));
    if (minPrice !== undefined && minPrice !== "") {
      filter.price = { ...(filter.price || {}), $gte: Number(minPrice) };
    }
    if (maxPrice !== undefined && maxPrice !== "") {
      filter.price = { ...(filter.price || {}), $lte: Number(maxPrice) };
    }
    if (status === "soldout") filter.stock = 0;
    if (status === "selling") filter.stock = { $gt: 0 };

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug discountPercent")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);

    res.json({
      products: products.map(withPricing),
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      total,
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name slug discountPercent")
      .populate("attributes", "title displayName option values isActive");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    const coupons = await couponsForTarget({
      productId: product._id,
      categoryId: product.category?._id || product.category,
    });
    res.json({ ...withPricing(product), coupons });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const payload = await buildPayload(req);
    const product = await Product.create(payload);
    await product.populate("category", "name slug discountPercent");
    const couponInput = parseCouponFields(req.body);
    if (couponInput) {
      await upsertScopedCoupon({ ...couponInput, appliesTo: "product", productId: product._id });
    }
    const coupons = await couponsForTarget({
      productId: product._id,
      categoryId: product.category?._id || product.category,
    });
    res.status(201).json({ ...withPricing(product), coupons });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const current = await Product.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: "Product not found" });
    }
    const payload = await buildPayload(req, current.toObject());
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...payload,
          weight: payload.weight,
          volume: payload.volume,
          width: payload.width,
          height: payload.height,
        },
      },
      { new: true, runValidators: true, overwrite: false, strict: false }
    ).populate("category", "name slug discountPercent");
    const couponInput = parseCouponFields(req.body);
    if (couponInput) {
      await upsertScopedCoupon({ ...couponInput, appliesTo: "product", productId: product._id });
    }
    const coupons = await couponsForTarget({
      productId: product._id,
      categoryId: product.category?._id || product.category,
    });
    res.json({ ...withPricing(product), coupons });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Product removed" });
  } catch (error) {
    next(error);
  }
};

const patchProductFlags = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (req.body.featured !== undefined) product.featured = parseBoolean(req.body.featured, product.featured);
    if (req.body.isActive !== undefined) product.isActive = parseBoolean(req.body.isActive, product.isActive);
    await product.save();
    await product.populate("category", "name slug discountPercent");
    res.json(withPricing(product));
  } catch (error) {
    next(error);
  }
};

const bulkDeleteProducts = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : [];
    if (!ids.length) return res.status(400).json({ message: "Select at least one product" });
    const result = await Product.deleteMany({ _id: { $in: ids } });
    res.json({ removed: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  patchProductFlags,
  bulkDeleteProducts,
};
