const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  permissions:
    user.role === "admin"
      ? ["*"]
      : user.role === "delivery"
        ? ["orders:read", "orders:write"]
        : user.permissions || [],
  isActive: user.isActive,
  emailVerified: user.emailVerified !== false,
  phone: user.phone || "",
});

module.exports = { publicUser };
