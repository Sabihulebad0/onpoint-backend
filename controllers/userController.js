const User = require("../models/User");
const { PERMISSIONS, ROLES } = require("../utils/permissions");
const { publicUser } = require("../utils/publicUser");
const { upsertCustomerFromUser } = require("../utils/customer");

const sanitizePermissions = (permissions = []) =>
  [...new Set(permissions)].filter((item) => PERMISSIONS.includes(item));

const listUsers = async (req, res, next) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role && ROLES.includes(role)) filter.role = role;
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      users: users.map(publicUser),
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      permissions: PERMISSIONS,
      roles: ROLES,
    });
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = "customer", permissions = [], phone = "" } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      emailVerified: true,
      permissions: role === "admin" ? [] : sanitizePermissions(permissions),
    });
    await upsertCustomerFromUser(user);

    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

const ensureAnotherAdmin = async (userId) => {
  const remaining = await User.countDocuments({
    _id: { $ne: userId },
    role: "admin",
    isActive: true,
  });
  return remaining > 0;
};

const updateAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { role, permissions, isActive, name, phone, email, password } = req.body;

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (email) {
      const nextEmail = String(email).toLowerCase().trim();
      const taken = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
      if (taken) {
        return res.status(409).json({ message: "Email already registered" });
      }
      user.email = nextEmail;
    }
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      user.password = password;
    }
    if (typeof isActive === "boolean") {
      if (user.role === "admin" && isActive === false && !(await ensureAnotherAdmin(user._id))) {
        return res.status(400).json({ message: "Cannot disable the last admin" });
      }
      user.isActive = isActive;
    }

    if (role) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      if (user.role === "admin" && role !== "admin" && !(await ensureAnotherAdmin(user._id))) {
        return res.status(400).json({ message: "Cannot remove the last admin" });
      }
      user.role = role;
    }

    if (permissions) {
      user.permissions = user.role === "admin" ? [] : sanitizePermissions(permissions);
    }

    await user.save();
    res.json({ user: publicUser(user), message: "Access updated" });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    if (user.role === "admin" && !(await ensureAnotherAdmin(user._id))) {
      return res.status(400).json({ message: "Cannot delete the last admin" });
    }

    await user.deleteOne();
    res.json({ message: "User removed" });
  } catch (error) {
    next(error);
  }
};

module.exports = { listUsers, getUser, createUser, updateAccess, deleteUser };
