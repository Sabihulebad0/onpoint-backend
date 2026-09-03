const express = require("express");
const { getDashboard } = require("../controllers/dashboardController");
const { protect, requireStaff } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, requireStaff, getDashboard);

module.exports = router;
