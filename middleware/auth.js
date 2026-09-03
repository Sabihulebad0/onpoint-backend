const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { hasPermission, canAccessAdmin } = require("../utils/permissions");

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is disabled" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Admin access required" });
};

const requirePermission = (...permissions) => (req, res, next) => {
  const allowed = permissions.some((permission) => hasPermission(req.user, permission));
  if (allowed) return next();
  return res.status(403).json({ message: "You do not have permission for this action" });
};

const requireStaff = (req, res, next) => {
  if (canAccessAdmin(req.user)) return next();
  return res.status(403).json({ message: "Staff or admin access required" });
};

module.exports = { protect, admin, requirePermission, requireStaff };
