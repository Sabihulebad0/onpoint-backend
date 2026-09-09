const User = require("../models/User");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const { canAccessAdmin } = require("../utils/permissions");
const { publicUser } = require("../utils/publicUser");
const { notifyAdmins } = require("../utils/notify");
const { upsertCustomerFromUser } = require("../utils/customer");

const OTP_MINUTES = 10;
const OTP_FIELDS = "+emailOtpHash +emailOtpExpires +emailOtpPurpose";

const hashValue = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const makeOtp = () => String(Math.floor(1000 + Math.random() * 9000));
const normEmail = (value) => String(value || "").trim().toLowerCase();

const assignOtp = async (user, purpose) => {
  const code = makeOtp();
  user.emailOtpHash = hashValue(code);
  user.emailOtpExpires = new Date(Date.now() + OTP_MINUTES * 60 * 1000);
  user.emailOtpPurpose = purpose;
  await user.save({ validateBeforeSave: false });
  return code;
};

const otpMatches = (user, code, purpose) => {
  if (!user?.emailOtpHash || !user.emailOtpExpires || user.emailOtpExpires < new Date()) return false;
  if (purpose && user.emailOtpPurpose !== purpose) return false;
  return user.emailOtpHash === hashValue(code);
};

const otpPayload = (code) => {
  const payload = { expiresInMinutes: OTP_MINUTES, emailSent: mailConfigured() };
  if (!mailConfigured()) payload.devCode = code;
  return payload;
};

const sendOtpSafe = async (user, code, purpose) => {
  try {
    await sendOtpEmail(user.email, user.name, code, purpose);
  } catch (error) {
    console.error("[mail] OTP send failed:", error.message);
  }
};

const register = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normEmail(req.body.email);
    const password = String(req.body.password || "");
    const phone = String(req.body.phone || "").trim();
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const requestedRole = String(req.body.role || "").toLowerCase();
    const role = requestedRole === "delivery" ? "delivery" : "customer";
    let user = await User.findOne({ email }).select(`+password ${OTP_FIELDS}`);

    if (user && (user.emailVerified !== false || user.role !== "customer")) {
      return res.status(409).json({ message: "Email already registered" });
    }

    if (user && user.emailVerified === false) {
      user.name = name;
      user.phone = phone || user.phone;
      user.password = password;
      const code = await assignOtp(user, "signup");
      await sendOtpSafe(user, code, "signup");
      return res.status(200).json({
        needsVerification: true,
        email: user.email,
        message: "We sent a new verification code to your email.",
        ...otpPayload(code),
      });
    }

    user = await User.create({
      name,
      email,
      password,
      phone,
      role,
      emailVerified: role !== "customer",
    });
    await upsertCustomerFromUser(user);

    if (role === "customer") {
      const code = await assignOtp(user, "signup");
      await sendOtpSafe(user, code, "signup");
      await notifyAdmins({
        title: "New customer signed up",
        message: `${user.name} (${user.email}) created an account.`,
        type: "user",
        link: `/users/${user._id}/edit`,
        meta: { userId: user._id },
      });
      return res.status(201).json({
        needsVerification: true,
        email: user.email,
        message: "Enter the 4-digit code we emailed you.",
        ...otpPayload(code),
      });
    }

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
    const email = normEmail(req.body.email);
    const password = String(req.body.password || "");
    const user = await User.findOne({ email }).select(`+password ${OTP_FIELDS}`);

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is disabled" });
    }

    if (user.role === "customer" && user.emailVerified === false) {
      const code = await assignOtp(user, "signup");
      await sendOtpSafe(user, code, "signup");
      return res.status(403).json({
        needsVerification: true,
        email: user.email,
        message: "Verify your email before signing in. We sent a new code.",
        ...otpPayload(code),
      });
    }

    await upsertCustomerFromUser(user);

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
    const email = normEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const generic = { message: "If that email is registered, you can reset the password." };
    const user = await User.findOne({ email }).select(OTP_FIELDS);
    if (!user || user.isActive === false) {
      return res.json(generic);
    }

    const code = await assignOtp(user, "reset");
    await sendOtpSafe(user, code, "reset");
    res.json({
      ...generic,
      ...otpPayload(code),
    });
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    const code = String(req.body.code || req.body.otp || "").replace(/\D/g, "");
    const purpose = String(req.body.purpose || "signup").toLowerCase() === "reset" ? "reset" : "signup";
    if (!email || code.length !== 4) {
      return res.status(400).json({ message: "Email and a 4-digit code are required" });
    }

    const user = await User.findOne({ email }).select(OTP_FIELDS);
    if (!user || !otpMatches(user, code, purpose)) {
      return res.status(400).json({ message: "That code is invalid or has expired" });
    }

    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    user.emailOtpPurpose = undefined;

    if (purpose === "signup") {
      user.emailVerified = true;
      await user.save({ validateBeforeSave: false });
      await upsertCustomerFromUser(user);
      sendWelcomeEmail(user.email, user.name).catch((error) => console.error("[mail] welcome failed:", error.message));
      return res.json({
        token: generateToken(user._id),
        user: publicUser(user),
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = hashValue(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    res.json({ resetToken, email: user.email });
  } catch (error) {
    next(error);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    const purpose = String(req.body.purpose || "signup").toLowerCase() === "reset" ? "reset" : "signup";
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select(OTP_FIELDS);
    const generic = { message: "If that email is registered, a new code is on the way." };
    if (!user || user.isActive === false) {
      return res.json(generic);
    }
    if (purpose === "signup" && user.emailVerified !== false) {
      return res.json({ message: "This email is already verified. You can sign in." });
    }

    const code = await assignOtp(user, purpose);
    await sendOtpSafe(user, code, purpose);
    res.json({
      ...generic,
      ...otpPayload(code),
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

    const user = await User.findOne({
      resetPasswordToken: hashValue(token),
      resetPasswordExpires: { $gt: new Date() },
    }).select("+password +resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.emailVerified = true;
    await user.save();
    sendPasswordChangedEmail(user.email, user.name).catch((error) =>
      console.error("[mail] password-changed failed:", error.message)
    );

    res.json({
      message: "Password updated",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, forgotPassword, resetPassword, verifyOtp, resendOtp };
