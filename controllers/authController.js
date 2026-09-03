const User = require("../models/User");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const { canAccessAdmin } = require("../utils/permissions");
const { publicUser } = require("../utils/publicUser");
const { notifyAdmins } = require("../utils/notify");

const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const requestedRole = String(req.body.role || "").toLowerCase();
    const role = requestedRole === "delivery" ? "delivery" : "customer";
    const user = await User.create({ name, email, password, phone: phone || "", role });
    await notifyAdmins({
      title: "New customer signed up",
      message: `${user.name} (${user.email}) created an account.`,
      type: "user",
      link: `/users/${user._id}/edit`,
      meta: { userId: user._id },
    });

    res.status(201).json({
      token: generateToken(user._id),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is disabled" });
    }

    res.json({
      token: generateToken(user._id),
      user: publicUser(user),
      canAccessAdmin: canAccessAdmin(user),
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res) => {
  res.json({
    user: publicUser(req.user),
    canAccessAdmin: canAccessAdmin(req.user),
  });
};

const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    const generic = { message: "If that email is registered, you can reset the password." };
    if (!user || user.isActive === false) {
      return res.json(generic);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    res.json({
      ...generic,
      resetToken,
      expiresInMinutes: 60,
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const token = String(req.body.token || req.body.resetToken || "").trim();
    const password = String(req.body.password || "").trim();
    if (!token || !password) {
      return res.status(400).json({ message: "Reset token and new password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+password +resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      message: "Password updated",
      token: generateToken(user._id),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, forgotPassword, resetPassword };
