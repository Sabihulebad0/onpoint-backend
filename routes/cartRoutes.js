const express = require("express");
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  applyCoupon,
  removeCoupon,
  clearCart,
} = require("../controllers/cartController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.get("/", getCart);
router.post("/", addToCart);
router.post("/add", addToCart);
router.put("/", updateCartItem);
router.delete("/item", removeCartItem);
router.post("/coupon", applyCoupon);
router.delete("/coupon", removeCoupon);
router.delete("/", clearCart);

module.exports = router;
