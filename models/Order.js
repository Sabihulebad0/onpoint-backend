const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    sku: { type: String, default: "" },
    image: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    size: String,
    color: String,
    custom: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isGuest: { type: Boolean, default: false },
    guestToken: { type: String, default: "" },
    items: { type: [orderItemSchema], required: true },
    shipping_address: {
      first_name: { type: String, default: "" },
      last_name: { type: String, default: "" },
      address_line1: { type: String, default: "" },
      address_line2: { type: String, default: "" },
      city: { type: String, default: "" },
      state_province: { type: String, default: "" },
      postal_code: { type: String, default: "" },
      country_code: { type: String, default: "", uppercase: true, trim: true },
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      phone: String,
    },
    customerName: { type: String, default: "" },
    customerEmail: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    paymentMethod: {
      type: String,
      enum: ["cod", "card"],
      default: "cod",
    },
    itemsPrice: { type: Number, required: true, min: 0 },
    couponCode: { type: String, default: "", uppercase: true, trim: true },
    couponDiscount: { type: Number, min: 0, default: 0 },
    shippingPrice: { type: Number, required: true, min: 0, default: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    subtotal: { type: Number, min: 0, default: 0 },
    shipping_total: { type: Number, min: 0, default: 0 },
    tax_total: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, default: 0 },
    taxState: { type: String, default: "" },
    discount_total: { type: Number, min: 0, default: 0 },
    grand_total: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "delivered", "cancelled", "returned", "refunded"],
      default: "pending",
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    trackingId: { type: String, default: "" },
    deliveredAt: { type: Date, default: null },
    statusHistory: [
      {
        status: { type: String },
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
