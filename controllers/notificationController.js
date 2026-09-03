const Notification = require("../models/Notification");
const User = require("../models/User");
const { NOTIFICATION_TYPES } = require("../utils/notificationTypes");
const { createForUsers, findRecipients } = require("../utils/notify");

const TARGET_ROLES = ["all", "admin", "staff", "delivery", "customer"];

const buildFilter = (req) => {
  const filter = { user: req.user._id };
  if (req.query.unread === "true") filter.isRead = false;
  if (req.query.unread === "false") filter.isRead = true;
  if (NOTIFICATION_TYPES.includes(req.query.type)) filter.type = req.query.type;
  return filter;
};

const listNotifications = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const filter = buildFilter(req);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    res.json({
      notifications,
      unreadCount,
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
};

const createNotification = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) {
      return res.status(400).json({ message: "Notification title is required" });
    }

    const payload = {
      title,
      message: String(req.body.message || "").trim(),
      type: NOTIFICATION_TYPES.includes(req.body.type) ? req.body.type : "system",
      link: req.body.link || "",
      meta: req.body.meta || {},
      createdBy: req.user._id,
    };

    let created = [];
    if (req.body.userId) {
      const recipient = await User.findById(req.body.userId).select("_id role");
      if (!recipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      created = await createForUsers([recipient._id], {
        ...payload,
        audience: recipient.role === "customer" ? "customer" : "admin",
      });
    } else {
      const target = TARGET_ROLES.includes(req.body.role) ? req.body.role : "admin";
      const roles = target === "all" ? ["admin", "staff", "delivery", "customer"] : [target];
      const staffRoles = roles.filter((role) => role !== "customer");

      if (staffRoles.length) {
        const recipients = await findRecipients(staffRoles);
        created = created.concat(await createForUsers(recipients, { ...payload, audience: "admin" }));
      }
      if (roles.includes("customer")) {
        const recipients = await findRecipients(["customer"]);
        created = created.concat(await createForUsers(recipients, { ...payload, audience: "customer" }));
      }
    }

    if (created.length === 0) {
      return res.status(400).json({ message: "No active recipients matched this notification" });
    }

    res.status(201).json({ created: created.length, notifications: created });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const isRead = req.body.isRead !== false && req.body.isRead !== "false";
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead, readAt: isRead ? new Date() : null },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json(notification);
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ updated: result.modifiedCount || 0, unreadCount: 0 });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Notification removed" });
  } catch (error) {
    next(error);
  }
};

const clearNotifications = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.read === "true") filter.isRead = true;
    const result = await Notification.deleteMany(filter);
    res.json({ removed: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listNotifications,
  getUnreadCount,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications,
};
