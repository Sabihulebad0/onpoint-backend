const express = require("express");
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  patchCategoryStatus,
  bulkDeleteCategories,
} = require("../controllers/categoryController");
const { protect, requirePermission } = require("../middleware/auth");
const { categoryIcon } = require("../middleware/upload");

const router = express.Router();
const canWrite = requirePermission("categories:write");

router.get("/", getCategories);
router.post("/bulk-delete", protect, canWrite, bulkDeleteCategories);
router.get("/:id", getCategory);
router.post("/", protect, canWrite, categoryIcon, createCategory);
router.put("/:id", protect, canWrite, categoryIcon, updateCategory);
router.patch("/:id/status", protect, canWrite, patchCategoryStatus);
router.delete("/:id", protect, canWrite, deleteCategory);

module.exports = router;
