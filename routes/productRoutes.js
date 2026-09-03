const express = require("express");
const {
  getProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  patchProductFlags,
  bulkDeleteProducts,
} = require("../controllers/productController");
const { protect, requirePermission } = require("../middleware/auth");
const { productImages } = require("../middleware/upload");

const router = express.Router();

router.get("/", getProducts);
router.get("/search", searchProducts);
router.post("/bulk-delete", protect, requirePermission("products:write"), bulkDeleteProducts);
router.get("/:id", getProductById);
router.post("/", protect, requirePermission("products:write"), productImages, createProduct);
router.put("/:id", protect, requirePermission("products:write"), productImages, updateProduct);
router.patch("/:id/flags", protect, requirePermission("products:write"), patchProductFlags);
router.delete("/:id", protect, requirePermission("products:write"), deleteProduct);

module.exports = router;
