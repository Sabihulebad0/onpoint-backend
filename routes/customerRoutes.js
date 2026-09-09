const express = require("express");
const {
  listCustomers,
  getCustomer,
  getCustomerOrders,
  updateCustomer,
  createCustomer,
  deleteCustomer,
  bulkDeleteCustomers,
} = require("../controllers/customerController");
const { protect, requireStaff } = require("../middleware/auth");

const router = express.Router();

router.use(protect, requireStaff);
router.get("/", listCustomers);
router.post("/", createCustomer);
router.post("/bulk-delete", bulkDeleteCustomers);
router.get("/:id/orders", getCustomerOrders);
router.get("/:id", getCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

module.exports = router;
