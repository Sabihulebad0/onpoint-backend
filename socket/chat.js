const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ChatThread = require("../models/ChatThread");
const { canAccessAdmin } = require("../utils/permissions");
const {
  publicMessage,
  publicThread,
  ensureThread,
  addMessage,
  notifyNewChat,
} = require("../controllers/chatController");

const attachChat = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || String(socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("Not authorized"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || user.isActive === false) return next(new Error("Not authorized"));
      socket.user = user;
      socket.isStaff = canAccessAdmin(user);
      next();
    } catch {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.isStaff) socket.join("support");

    socket.on("chat:join", async (payload = {}) => {
      try {
        if (socket.isStaff) {
          const threadId = payload.threadId;
          if (threadId) socket.join(`thread:${threadId}`);
          socket.join("support");
          socket.emit("chat:joined", { staff: true });
          return;
        }
        const thread = await ensureThread(socket.user);
        socket.threadId = String(thread._id);
        socket.join(`thread:${thread._id}`);
        socket.emit("chat:joined", { thread: publicThread(thread) });
      } catch (error) {
        socket.emit("chat:error", { message: error.message || "Could not join chat" });
      }
    });

    socket.on("chat:message", async (payload = {}) => {
      try {
        const text = String(payload.text || "").trim();
        if (!text) return;
        let thread;
        let role = "customer";
        if (socket.isStaff) {
          if (!payload.threadId) {
            socket.emit("chat:error", { message: "Select a conversation first" });
            return;
          }
          thread = await ChatThread.findById(payload.threadId);
          role = "staff";
        } else {
          thread = await ensureThread(socket.user);
        }
        if (!thread) {
          socket.emit("chat:error", { message: "Chat not found" });
          return;
        }
        if (socket.isStaff) socket.join(`thread:${thread._id}`);
        const isFirstCustomer = !socket.isStaff && !thread.lastMessage;
        const message = await addMessage({ thread, user: socket.user, role, text });
        const packed = publicMessage(message);
        io.to(`thread:${thread._id}`).emit("chat:message", packed);
        io.to("support").emit("chat:thread", publicThread(thread));
        if (!socket.isStaff && isFirstCustomer) {
          notifyNewChat(thread, message);
        }
      } catch (error) {
        socket.emit("chat:error", { message: error.message || "Could not send message" });
      }
    });

    socket.on("chat:typing", (payload = {}) => {
      const threadId = socket.isStaff ? payload.threadId : socket.threadId || payload.threadId;
      if (!threadId) return;
      const body = {
        threadId,
        name: socket.user?.name || "",
        typing: Boolean(payload.typing),
        staff: socket.isStaff,
      };
      socket.to(`thread:${threadId}`).emit("chat:typing", body);
      if (!socket.isStaff) socket.to("support").emit("chat:typing", body);
    });
  });
};

module.exports = { attachChat };
