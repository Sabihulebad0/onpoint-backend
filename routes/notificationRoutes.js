const express = require("express");
const {
  listNotifications,
  getUnreadCount,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications,
} = require("../controllers/notificationController");
const { protect, requireStaff } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/", listNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/", requireStaff, createNotification);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);
router.delete("/", clearNotifications);

module.exports = router;
