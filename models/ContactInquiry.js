const mongoose = require("mongoose");

const STATUSES = ["new", "read", "replied", "archived"];
const INTERESTED_IN = ["Custom Jerseys", "Team Uniforms", "Sublimation", "Embroidery"];

const contactInquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    interestedIn: { type: String, default: "", trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: STATUSES, default: "new", index: true },
    adminNotes: { type: String, default: "", trim: true },
    source: { type: String, default: "website", trim: true },
  },
  { timestamps: true }
);

contactInquirySchema.index({ createdAt: -1 });
contactInquirySchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model("ContactInquiry", contactInquirySchema);
module.exports.CONTACT_STATUSES = STATUSES;
module.exports.INTERESTED_IN = INTERESTED_IN;
