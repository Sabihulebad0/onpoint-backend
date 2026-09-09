const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home", trim: true },
    first_name: { type: String, default: "", trim: true },
    last_name: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    address_line1: { type: String, default: "", trim: true },
    address_line2: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state_province: { type: String, default: "", trim: true },
    postal_code: { type: String, default: "", trim: true },
    country_code: { type: String, default: "US", uppercase: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, default: "", trim: true },
    type: { type: String, enum: ["login", "guest"], default: "guest", index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    addresses: { type: [addressSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", email: "text", phone: "text" });

module.exports = mongoose.model("Customer", customerSchema);
