const ContactInquiry = require("../models/ContactInquiry");
const { CONTACT_STATUSES, INTERESTED_IN } = require("../models/ContactInquiry");
const { notifyAdmins } = require("../utils/notify");
const { sendContactReceivedEmail, sendContactAdminEmail } = require("../utils/mail");

const emailOk = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const publicInquiry = (doc) => {
  const data = doc.toObject ? doc.toObject() : doc;
  return {
    _id: data._id,
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    interestedIn: data.interestedIn || "",
    message: data.message,
    status: data.status || "new",
    adminNotes: data.adminNotes || "",
    source: data.source || "website",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

const createInquiry = async (req, res, next) => {
  try {
    const name = String(req.body.name || req.body.fullName || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const interestedIn = String(req.body.interestedIn || "").trim();
    const message = String(req.body.message || "").trim();

    if (!name) return res.status(400).json({ message: "Full name is required" });
    if (!emailOk(email)) return res.status(400).json({ message: "A valid email is required" });
    if (!message) return res.status(400).json({ message: "Message is required" });
    if (message.length > 5000) return res.status(400).json({ message: "Message is too long" });

    const inquiry = await ContactInquiry.create({
      name,
      email,
      phone,
      interestedIn: INTERESTED_IN.includes(interestedIn) ? interestedIn : interestedIn,
      message,
      source: String(req.body.source || "website").trim() || "website",
    });

    await notifyAdmins({
      title: `New contact from ${name}`,
      message: `${interestedIn ? `${interestedIn} · ` : ""}${email}${phone ? ` · ${phone}` : ""}`,
      type: "contact",
      link: `/contacts/${inquiry._id}`,
      meta: { inquiryId: inquiry._id, email },
    });

    sendContactReceivedEmail(inquiry).catch((error) =>
      console.error("[mail] contact confirmation failed:", error.message)
    );
    sendContactAdminEmail(inquiry).catch((error) =>
      console.error("[mail] contact admin alert failed:", error.message)
    );

    res.status(201).json({
      message: "Thanks — your message has been sent.",
      inquiry: { _id: inquiry._id },
    });
  } catch (error) {
    next(error);
  }
};

const listInquiries = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && CONTACT_STATUSES.includes(status)) filter.status = status;
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { interestedIn: rx }, { message: rx }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [inquiries, total] = await Promise.all([
      ContactInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      ContactInquiry.countDocuments(filter),
    ]);

    res.json({
      inquiries: inquiries.map(publicInquiry),
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
    });
  } catch (error) {
    next(error);
  }
};

const getInquiry = async (req, res, next) => {
  try {
    const inquiry = await ContactInquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (inquiry.status === "new") {
      inquiry.status = "read";
      await inquiry.save();
    }
    res.json({ inquiry: publicInquiry(inquiry) });
  } catch (error) {
    next(error);
  }
};

const updateInquiry = async (req, res, next) => {
  try {
    const inquiry = await ContactInquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

    if (req.body.status !== undefined) {
      const status = String(req.body.status || "").trim();
      if (!CONTACT_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      inquiry.status = status;
    }
    if (req.body.adminNotes !== undefined) {
      inquiry.adminNotes = String(req.body.adminNotes || "").trim();
    }
    await inquiry.save();
    res.json({ inquiry: publicInquiry(inquiry) });
  } catch (error) {
    next(error);
  }
};

const deleteInquiry = async (req, res, next) => {
  try {
    const inquiry = await ContactInquiry.findByIdAndDelete(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    res.json({ message: "Inquiry removed" });
  } catch (error) {
    next(error);
  }
};

const bulkDeleteInquiries = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : [];
    if (!ids.length) return res.status(400).json({ message: "Select at least one inquiry" });
    const result = await ContactInquiry.deleteMany({ _id: { $in: ids } });
    res.json({ removed: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInquiry,
  listInquiries,
  getInquiry,
  updateInquiry,
  deleteInquiry,
  bulkDeleteInquiries,
};
