const mongoose = require("mongoose");

const chatThreadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    lastMessage: { type: String, default: "" },
    lastAt: { type: Date, default: Date.now },
    unreadStaff: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatThread", chatThreadSchema);
