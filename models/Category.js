const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    type: { type: String, enum: ["standard", "customizable"], default: "standard", index: true },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
