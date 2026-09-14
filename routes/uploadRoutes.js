const express = require("express");
const { uploadCustom } = require("../controllers/uploadController");
const { optionalProtect } = require("../middleware/auth");
const { customImage } = require("../middleware/upload");

const router = express.Router();

router.post("/custom", optionalProtect, customImage, uploadCustom);

module.exports = router;
