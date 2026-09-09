const sgMail = require("@sendgrid/mail");

const FROM_EMAIL = process.env.EMAIL_FROM || process.env.SENDGRID_FROM || "noreply@onpointsports.com";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "On Point Sportswear";
const BRAND = "#00AB3A";

const hasKey = () => Boolean(String(process.env.SENDGRID_API_KEY || "").trim());

const wrap = (title, body) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#05070c;font-family:Arial,Helvetica,sans-serif;color:#e8edf5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#05070c;padding:28px 12px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141a24;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND};padding:18px 24px;color:#fff;font-size:20px;font-weight:700;">
              On Point Sportswear
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;font-size:22px;font-weight:700;color:#fff;">${title}</td>
          </tr>
          <tr>
            <td style="padding:0 24px 28px;font-size:15px;line-height:1.6;color:#c5cddb;">${body}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const otpBox = (code) =>
  `<div style="margin:18px 0;padding:14px 18px;background:#0b3d24;border-radius:12px;color:#fff;font-size:32px;letter-spacing:10px;font-weight:800;text-align:center;">${code}</div>`;

async function sendMail({ to, subject, html, text }) {
  const recipient = String(to || "").trim().toLowerCase();
  if (!recipient) return { skipped: true, reason: "no-recipient" };

  if (!hasKey()) {
    console.warn(`[mail] SENDGRID_API_KEY missing. "${subject}" to ${recipient} was not sent.`);
    if (text) console.warn(`[mail] ${text}`);
    return { skipped: true, reason: "no-key" };
  }

  if (!sgMail.__ready) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sgMail.__ready = true;
  }

  await sgMail.send({
    to: recipient,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    html,
    text: text || subject,
  });
  return { sent: true };
}

const sendOtpEmail = (to, name, code, purpose = "signup") => {
  const reset = purpose === "reset";
  const title = reset ? "Password recovery code" : "Verify your email";
  const intro = reset
    ? `Hi ${name || "there"}, use this 4-digit code to reset your On Point password.`
    : `Hi ${name || "there"}, welcome to On Point. Enter this 4-digit code to verify your email.`;
  return sendMail({
    to,
    subject: reset ? "Your On Point password reset code" : "Verify your On Point email",
    text: `${intro} Code: ${code}. It expires in 10 minutes.`,
    html: wrap(title, `${intro}${otpBox(code)}<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`),
  });
};

const sendWelcomeEmail = (to, name) =>
  sendMail({
    to,
    subject: "Your On Point account is ready",
    text: `Hi ${name || "there"}, your email is verified. You can now shop and customize gear.`,
    html: wrap(
      "You're in",
      `<p>Hi ${name || "there"}, your email is verified. Start customizing jerseys, hoodies, and more.</p>`
    ),
  });

const sendPasswordChangedEmail = (to, name) =>
  sendMail({
    to,
    subject: "Your On Point password was changed",
    text: `Hi ${name || "there"}, your password was updated. If this was not you, reset it immediately.`,
    html: wrap(
      "Password changed",
      `<p>Hi ${name || "there"}, your password was updated successfully. If you did not do this, reset your password right away.</p>`
    ),
  });

const orderLabel = (order) => {
  const created = order?.createdAt ? new Date(order.createdAt) : new Date();
  const y = created.getFullYear();
  const m = String(created.getMonth() + 1).padStart(2, "0");
  const d = String(created.getDate()).padStart(2, "0");
  const tail = String(order?._id || "0000").slice(-4).toUpperCase();
  return `#ON-${y}${m}${d}-${tail}`;
};

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const sendOrderCreatedEmail = (order) => {
  const to = order.customerEmail;
  const name = order.customerName || "there";
  const number = orderLabel(order);
  const rows = (order.items || [])
    .map((item) => `<tr><td style="padding:6px 0;color:#fff;">${item.name} × ${item.quantity}</td><td style="text-align:right;color:#7CFF3A;">${money(item.price * item.quantity)}</td></tr>`)
    .join("");
  return sendMail({
    to,
    subject: `Order confirmed ${number}`,
    text: `Hi ${name}, we received order ${number}. Total ${money(order.grand_total || order.totalPrice)}.`,
    html: wrap(
      "Order confirmed",
      `<p>Hi ${name}, thanks for your order <strong style="color:#fff;">${number}</strong>.</p>
       <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
       <p style="margin-top:16px;">Total: <strong style="color:#7CFF3A;">${money(order.grand_total || order.totalPrice)}</strong></p>
       <p>Tracking ID: ${order.trackingId || "Assigned soon"}</p>`
    ),
  });
};

const sendOrderStatusEmail = (order, status) => {
  const to = order.customerEmail || order.user?.email;
  const name = order.customerName || order.user?.name || "there";
  const number = orderLabel(order);
  const copy = {
    shipped: `Your order ${number} is on the way. Tracking: ${order.trackingId || "updating soon"}.`,
    delivered: `Your order ${number} has been delivered. Enjoy the gear.`,
    cancelled: `Your order ${number} was cancelled.`,
    refunded: `A refund for order ${number} is being processed.`,
  }[status];
  if (!copy) return Promise.resolve({ skipped: true });
  return sendMail({
    to,
    subject: `Order ${status}: ${number}`,
    text: `Hi ${name}, ${copy}`,
    html: wrap(`Order ${status}`, `<p>Hi ${name},</p><p>${copy}</p>`),
  });
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const adminNotifyEmails = () =>
  String(process.env.ADMIN_EMAIL || process.env.CONTACT_NOTIFY_EMAIL || process.env.EMAIL_ADMIN || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const sendContactReceivedEmail = (inquiry) => {
  const name = inquiry.name || "there";
  const topic = inquiry.interestedIn ? ` about ${inquiry.interestedIn}` : "";
  return sendMail({
    to: inquiry.email,
    subject: "We received your message — On Point Sportswear",
    text: `Hi ${name}, thanks for contacting On Point Sportswear${topic}. We received your message and will get back to you shortly.`,
    html: wrap(
      "We got your message",
      `<p>Hi ${escapeHtml(name)}, thanks for reaching out to On Point Sportswear.</p>
       <p>We received your inquiry${topic ? ` <strong style="color:#fff;">${escapeHtml(inquiry.interestedIn)}</strong>` : ""} and will reply within one business day.</p>
       <p style="margin-top:16px;color:#fff;">Your message:</p>
       <p style="white-space:pre-wrap;background:#0f141c;border-radius:10px;padding:14px;">${escapeHtml(inquiry.message)}</p>
       <p>If you need us sooner, call 647-805-5730 or reply to this email.</p>`
    ),
  });
};

const sendContactAdminEmail = async (inquiry) => {
  const User = require("../models/User");
  const fromEnv = adminNotifyEmails();
  let fromUsers = [];
  try {
    const admins = await User.find({ role: "admin", isActive: { $ne: false } }).select("email");
    fromUsers = admins.map((user) => String(user.email || "").trim().toLowerCase()).filter(Boolean);
  } catch {
    fromUsers = [];
  }
  const recipients = [...new Set([...fromEnv, ...fromUsers])];
  if (!recipients.length) {
    return { skipped: true, reason: "no-admin-email" };
  }

  const subject = `New contact: ${inquiry.name}${inquiry.interestedIn ? ` — ${inquiry.interestedIn}` : ""}`;
  const text = `${inquiry.name} (${inquiry.email}${inquiry.phone ? `, ${inquiry.phone}` : ""}) wrote:\n${inquiry.message}`;
  const html = wrap(
    "New website inquiry",
    `<p><strong style="color:#fff;">${escapeHtml(inquiry.name)}</strong> submitted the contact form.</p>
     <p>Email: ${escapeHtml(inquiry.email)}<br/>Phone: ${escapeHtml(inquiry.phone || "—")}<br/>Interested in: ${escapeHtml(inquiry.interestedIn || "—")}</p>
     <p style="white-space:pre-wrap;background:#0f141c;border-radius:10px;padding:14px;">${escapeHtml(inquiry.message)}</p>`
  );

  const results = [];
  for (const to of recipients) {
    results.push(await sendMail({ to, subject, text, html }));
  }
  return results;
};

module.exports = {
  sendMail,
  sendOtpEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendOrderCreatedEmail,
  sendOrderStatusEmail,
  sendContactReceivedEmail,
  sendContactAdminEmail,
  mailConfigured: hasKey,
};
