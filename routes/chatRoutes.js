const express = require("express");
const { getMyChat, listThreads, getThread } = require("../controllers/chatController");
const { protect, requireStaff } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, getMyChat);
router.get("/threads", protect, requireStaff, listThreads);
router.get("/threads/:id", protect, requireStaff, getThread);

module.exports = router;
