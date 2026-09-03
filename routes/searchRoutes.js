const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { search } = require("../controllers/searchController");

const router = express.Router();

const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
  } catch (error) {
    req.user = null;
  }
  next();
};

router.get("/", optionalAuth, search);

module.exports = router;
