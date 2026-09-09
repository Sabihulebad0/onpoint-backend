const express = require("express");
const {
  createInquiry,
  listInquiries,
  getInquiry,
  updateInquiry,
  deleteInquiry,
  bulkDeleteInquiries,
} = require("../controllers/contactController");
const { protect, requireStaff } = require("../middleware/auth");

const router = express.Router();

router.post("/", createInquiry);
router.get("/", protect, requireStaff, listInquiries);
router.post("/bulk-delete", protect, requireStaff, bulkDeleteInquiries);
router.get("/:id", protect, requireStaff, getInquiry);
router.patch("/:id", protect, requireStaff, updateInquiry);
router.delete("/:id", protect, requireStaff, deleteInquiry);

module.exports = router;
