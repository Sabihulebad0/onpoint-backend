const defaultPrefs = {
  orderUpdates: true,
  shippingAlerts: true,
  promotionalOffers: true,
  priceDropAlerts: true,
  savedDesignReminders: true,
  newArrivals: true,
};

const publicUser = (user) => ({
  id: user._id,
  _id: user._id,
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
  avatar: user.avatar || "",
  language: user.language || "en",
  notificationPrefs: { ...defaultPrefs, ...(user.notificationPrefs || {}) },
});

module.exports = { publicUser };
