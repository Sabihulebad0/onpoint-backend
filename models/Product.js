const mongoose = require("mongoose");

const variantOptionSchema = new mongoose.Schema(
  {
    attribute: { type: mongoose.Schema.Types.ObjectId, ref: "Attribute" },
    attributeTitle: { type: String, default: "" },
    valueId: { type: mongoose.Schema.Types.ObjectId },
    value: { type: String, default: "" },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    options: [variantOptionSchema],
    sku: { type: String, default: "", trim: true },
    barcode: { type: String, default: "", trim: true },
    price: { type: Number, min: 0, default: 0 },
    salePrice: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    image: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, uppercase: true, default: "" },
    barcode: { type: String, trim: true, default: "" },
    slug: { type: String, trim: true, lowercase: true, default: "" },
    tags: [{ type: String, trim: true }],
    shortDescription: { type: String, default: "", trim: true },
    description: { type: String, required: true },
    sport: { type: String, required: true, trim: true },
    brand: { type: String, default: "" },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    type: { type: String, enum: ["standard", "customizable"], default: "standard", index: true },
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: null },
    compareAtPrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    weight: { type: Number, min: 0, default: 0 },
    volume: { type: Number, min: 0, default: 0 },
    width: { type: Number, min: 0, default: 0 },
    height: { type: Number, min: 0, default: 0 },
    thumbnail: { type: String, default: "" },
    images: [{ type: String }],
    storage: { type: String, enum: ["s3", "local"], default: "local" },
    sizes: [{ type: String }],
    colors: [{ type: String }],
    hasVariants: { type: Boolean, default: false },
    attributes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attribute" }],
    variants: [variantSchema],
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: { type: String, default: "" },
    },
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text", shortDescription: "text", sport: "text", sku: "text" });
productSchema.index({ sku: 1 }, { unique: true, sparse: true, partialFilterExpression: { sku: { $type: "string", $gt: "" } } });

module.exports = mongoose.model("Product", productSchema);
