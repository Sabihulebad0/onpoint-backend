const express = require("express");
const {
  listAttributes,
  getAttribute,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  patchAttributeStatus,
  bulkDeleteAttributes,
  addAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
} = require("../controllers/attributeController");
const { protect, requirePermission } = require("../middleware/auth");

const router = express.Router();
const canWrite = requirePermission("products:write", "categories:write");

router.get("/", listAttributes);
router.post("/bulk-delete", protect, canWrite, bulkDeleteAttributes);
router.get("/:id", getAttribute);
router.post("/", protect, canWrite, createAttribute);
router.put("/:id", protect, canWrite, updateAttribute);
router.patch("/:id/status", protect, canWrite, patchAttributeStatus);
router.delete("/:id", protect, canWrite, deleteAttribute);
router.post("/:id/values", protect, canWrite, addAttributeValue);
router.put("/:id/values/:valueId", protect, canWrite, updateAttributeValue);
router.delete("/:id/values/:valueId", protect, canWrite, deleteAttributeValue);

module.exports = router;
