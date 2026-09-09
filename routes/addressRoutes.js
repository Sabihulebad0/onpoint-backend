const express = require("express");
const {
  listAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} = require("../controllers/addressController");
const { optionalProtect } = require("../middleware/auth");

const router = express.Router();

router.use(optionalProtect);
router.get("/", listAddresses);
router.post("/", createAddress);
router.put("/:id", updateAddress);
router.patch("/:id/default", setDefaultAddress);
router.delete("/:id", deleteAddress);

module.exports = router;
