const PERMISSIONS = [
  "products:write",
  "categories:write",
  "coupons:write",
  "orders:read",
  "orders:write",
  "users:manage",
];

const ROLES = ["customer", "staff", "admin", "delivery"];

const DELIVERY_PERMISSIONS = ["orders:read", "orders:write"];

const hasPermission = (user, permission) => {
  if (!user || user.isActive === false) return false;
  if (user.role === "admin") return true;
  if (user.role === "delivery") return DELIVERY_PERMISSIONS.includes(permission);
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
};

const canAccessAdmin = (user) =>
  Boolean(user) &&
  user.isActive !== false &&
  (user.role === "admin" || user.role === "staff" || user.role === "delivery");

module.exports = { PERMISSIONS, ROLES, hasPermission, canAccessAdmin };
