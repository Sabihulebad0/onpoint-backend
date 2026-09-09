const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { PERMISSIONS, ROLES } = require("../utils/permissions");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: "customer" },
    permissions: {
      type: [String],
      enum: PERMISSIONS,
      default: [],
    },
    isActive: { type: Boolean, default: true },
    phone: { type: String, default: "", trim: true },
    emailVerified: { type: Boolean, default: true },
    emailOtpHash: { type: String, select: false },
    emailOtpExpires: { type: Date, select: false },
    emailOtpPurpose: { type: String, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function matchPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
