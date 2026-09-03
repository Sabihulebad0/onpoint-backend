const express = require("express");
const {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  patchCouponStatus,
  bulkDeleteCoupons,
} = require("../controllers/couponController");
const { protect, requirePermission } = require("../middleware/auth");
const { couponImage } = require("../middleware/upload");

const router = express.Router();
const canWrite = requirePermission("coupons:write", "products:write", "categories:write");

router.get("/", protect, listCoupons);
router.post("/bulk-delete", protect, canWrite, bulkDeleteCoupons);
router.get("/:id", protect, getCoupon);
router.post("/", protect, canWrite, couponImage, createCoupon);
router.put("/:id", protect, canWrite, couponImage, updateCoupon);
router.patch("/:id/status", protect, canWrite, patchCouponStatus);
router.delete("/:id", protect, canWrite, deleteCoupon);

module.exports = router;
