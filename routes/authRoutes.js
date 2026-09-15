const express = require("express");
const {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  updateAvatar,
  forgotPassword,
  resetPassword,
  verifyOtp,
  resendOtp,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { anyImage } = require("../middleware/upload");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.put("/password", protect, changePassword);
router.post("/avatar", protect, anyImage, updateAvatar);

module.exports = router;
