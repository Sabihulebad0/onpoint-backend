const Notification = require("../models/Notification");
const User = require("../models/User");
const { NOTIFICATION_TYPES } = require("./notificationTypes");

const buildPayload = (recipientId, payload = {}) => ({
  user: recipientId,
  title: String(payload.title || "").trim(),
  message: String(payload.message || "").trim(),
  type: NOTIFICATION_TYPES.includes(payload.type) ? payload.type : "system",
  audience: payload.audience === "admin" ? "admin" : "customer",
  link: payload.link || "",
  meta: payload.meta || {},
  createdBy: payload.createdBy || undefined,
});

const createForUsers = async (recipientIds, payload) => {
  const unique = [...new Set((recipientIds || []).filter(Boolean).map(String))];
  if (unique.length === 0) return [];
  const docs = unique.map((recipientId) => buildPayload(recipientId, payload));
  if (!docs[0].title) return [];
  return Notification.insertMany(docs);
};

const findRecipients = async (roles) => {
  const users = await User.find({ role: { $in: roles }, isActive: { $ne: false } }).select("_id");
  return users.map((user) => user._id);
};

// Notifications are a side effect: a failure here must never break the request
// that triggered it, so every helper swallows and logs its own errors.
const safely = async (task) => {
  try {
    return await task();
  } catch (error) {
    console.warn("Notification not created:", error.message);
    return [];
  }
};

const notifyUser = (userId, payload) =>
  safely(() => createForUsers([userId], { ...payload, audience: "customer" }));

const notifyRoles = (roles, payload) =>
  safely(async () => createForUsers(await findRecipients(roles), payload));

const notifyAdmins = (payload) =>
  notifyRoles(["admin", "staff"], { ...payload, audience: "admin" });

module.exports = { notifyUser, notifyAdmins, notifyRoles, createForUsers, findRecipients };
