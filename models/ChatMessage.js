const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    thread: { type: mongoose.Schema.Types.ObjectId, ref: "ChatThread", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    role: { type: String, enum: ["customer", "staff", "system"], default: "customer" },
    name: { type: String, default: "" },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
