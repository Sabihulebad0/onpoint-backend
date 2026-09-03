const mongoose = require("mongoose");
const { ATTRIBUTE_OPTIONS } = require("../utils/attributeOptions");

const attributeValueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const attributeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    displayName: { type: String, default: "", trim: true },
    option: { type: String, enum: ATTRIBUTE_OPTIONS, default: "dropdown" },
    values: [attributeValueSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

attributeSchema.index({ title: 1 }, { unique: true });

module.exports = mongoose.model("Attribute", attributeSchema);
