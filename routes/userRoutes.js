const express = require("express");
const {
  listUsers,
  getUser,
  createUser,
  updateAccess,
  deleteUser,
} = require("../controllers/userController");
const { protect, requirePermission } = require("../middleware/auth");

const router = express.Router();

router.use(protect, requirePermission("users:manage"));
router.get("/", listUsers);
router.post("/", createUser);
router.get("/:id", getUser);
router.patch("/:id/access", updateAccess);
router.put("/:id", updateAccess);
router.delete("/:id", deleteUser);

module.exports = router;
