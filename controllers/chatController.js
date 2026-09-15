const ChatThread = require("../models/ChatThread");
const ChatMessage = require("../models/ChatMessage");
const { canAccessAdmin } = require("../utils/permissions");
const { notifyAdmins } = require("../utils/notify");

const publicMessage = (doc) => {
  const data = doc.toObject ? doc.toObject() : doc;
  return {
    _id: data._id,
    thread: data.thread,
    sender: data.sender,
    role: data.role,
    name: data.name || "",
    text: data.text,
    createdAt: data.createdAt,
  };
};

const publicThread = (doc) => {
  const data = doc.toObject ? doc.toObject() : doc;
  return {
    _id: data._id,
    user: data.user,
    name: data.name || "",
    email: data.email || "",
    status: data.status || "open",
    lastMessage: data.lastMessage || "",
    lastAt: data.lastAt || data.updatedAt,
    unreadStaff: data.unreadStaff || 0,
  };
};

const ensureThread = async (user) => {
  let thread = await ChatThread.findOne({ user: user._id });
  if (thread) {
    thread.name = user.name || thread.name;
    thread.email = user.email || thread.email;
    if (thread.status === "closed") thread.status = "open";
    await thread.save();
    return thread;
  }
  thread = await ChatThread.create({
    user: user._id,
    name: user.name || "",
    email: user.email || "",
    status: "open",
  });
  await ChatMessage.create({
    thread: thread._id,
    role: "system",
    name: "On Point Support",
    text: "Hi — you are connected to live chat. Send a message and our team will reply here.",
  });
  return thread;
};

const addMessage = async ({ thread, user, role, text }) => {
  const body = String(text || "").trim();
  if (!body) {
    const error = new Error("Message is required");
    error.statusCode = 400;
    throw error;
  }
  const message = await ChatMessage.create({
    thread: thread._id,
    sender: user?._id || null,
    role,
    name: user?.name || (role === "staff" ? "Support" : "Customer"),
    text: body.slice(0, 4000),
  });
  thread.lastMessage = message.text;
  thread.lastAt = message.createdAt;
  thread.status = "open";
  if (role === "customer") thread.unreadStaff = Number(thread.unreadStaff || 0) + 1;
  else thread.unreadStaff = 0;
  await thread.save();
  return message;
};

const getMyChat = async (req, res, next) => {
  try {
    const thread = await ensureThread(req.user);
    const messages = await ChatMessage.find({ thread: thread._id }).sort({ createdAt: 1 }).limit(200);
    res.json({ thread: publicThread(thread), messages: messages.map(publicMessage) });
  } catch (error) {
    next(error);
  }
};

const listThreads = async (req, res, next) => {
  try {
    if (!canAccessAdmin(req.user)) {
      return res.status(403).json({ message: "Staff access required" });
    }
    const threads = await ChatThread.find().sort({ lastAt: -1 }).limit(80);
    res.json({ threads: threads.map(publicThread) });
  } catch (error) {
    next(error);
  }
};

const getThread = async (req, res, next) => {
  try {
    if (!canAccessAdmin(req.user)) {
      return res.status(403).json({ message: "Staff access required" });
    }
    const thread = await ChatThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: "Chat not found" });
    thread.unreadStaff = 0;
    await thread.save();
    const messages = await ChatMessage.find({ thread: thread._id }).sort({ createdAt: 1 }).limit(300);
    res.json({ thread: publicThread(thread), messages: messages.map(publicMessage) });
  } catch (error) {
    next(error);
  }
};

const notifyNewChat = (thread, message) => {
  notifyAdmins({
    title: `Live chat from ${thread.name || thread.email || "customer"}`,
    message: message.text.slice(0, 140),
    type: "contact",
    link: `/live-chat`,
    meta: { threadId: thread._id },
  }).catch(() => {});
};

module.exports = {
  publicMessage,
  publicThread,
  ensureThread,
  addMessage,
  getMyChat,
  listThreads,
  getThread,
  notifyNewChat,
};
