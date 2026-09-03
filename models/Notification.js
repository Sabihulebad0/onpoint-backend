const mongoose = require("mongoose");
const { NOTIFICATION_TYPES } = require("../utils/notificationTypes");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: "", trim: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "system" },
    audience: { type: String, enum: ["admin", "customer"], default: "customer" },
    link: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
