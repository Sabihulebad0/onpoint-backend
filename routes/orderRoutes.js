const express = require("express");
const {
  createOrder,
  quoteOrder,
  getMyOrders,
  getOrders,
  getOrder,
  updateOrderStatus,
  listCouriers,
  assignOrder,
  unassignOrder,
  bulkAssignOrders,
  bulkUnassignOrders,
  bulkDeleteOrders,
} = require("../controllers/orderController");
const { protect, optionalProtect, requirePermission } = require("../middleware/auth");

const router = express.Router();
const canRead = requirePermission("orders:read");
const canWrite = requirePermission("orders:write");

router.post("/", optionalProtect, createOrder);
router.post("/quote", optionalProtect, quoteOrder);
router.get("/mine", protect, getMyOrders);
router.get("/", protect, canRead, getOrders);
router.get("/couriers", protect, canRead, listCouriers);
router.post("/bulk-delete", protect, canWrite, bulkDeleteOrders);
router.post("/bulk-assign", protect, canWrite, bulkAssignOrders);
router.post("/bulk-unassign", protect, canWrite, bulkUnassignOrders);
router.get("/:id", optionalProtect, getOrder);
router.put("/:id/status", protect, canWrite, updateOrderStatus);
router.put("/:id/assign", protect, canWrite, assignOrder);
router.put("/:id/unassign", protect, canWrite, unassignOrder);

module.exports = router;
