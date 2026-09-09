const Customer = require("../models/Customer");

const normEmail = (value) => String(value || "").trim().toLowerCase();

const shortId = (id) => String(id || "").slice(-4).toUpperCase();

const publicAddress = (address) => {
  if (!address) return null;
  const data = address.toObject ? address.toObject() : address;
  return {
    id: String(data._id),
    _id: data._id,
    label: data.label || "Home",
    first_name: data.first_name || "",
    last_name: data.last_name || "",
    email: data.email || "",
    phone: data.phone || "",
    address_line1: data.address_line1 || "",
    address_line2: data.address_line2 || "",
    city: data.city || "",
    state_province: data.state_province || "",
    postal_code: data.postal_code || "",
    country_code: data.country_code || "US",
    isDefault: Boolean(data.isDefault),
  };
};

const publicCustomer = (customer, extra = {}) => {
  const data = customer.toObject ? customer.toObject() : customer;
  return {
    _id: data._id,
    id: shortId(data._id),
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    type: data.type || "guest",
    user: data.user || null,
    joiningDate: data.createdAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    isActive: data.isActive !== false,
    addresses: (data.addresses || []).map(publicAddress),
    ...extra,
  };
};

const sameStreet = (a = {}, b = {}) =>
  String(a.address_line1 || "").trim().toLowerCase() === String(b.address_line1 || "").trim().toLowerCase() &&
  String(a.postal_code || "").trim() === String(b.postal_code || "").trim() &&
  String(a.city || "").trim().toLowerCase() === String(b.city || "").trim().toLowerCase();

const mergeAddressOnto = (customer, incoming) => {
  if (!incoming?.address_line1) return customer;
  const payload = {
    label: incoming.label || "Home",
    first_name: incoming.first_name || "",
    last_name: incoming.last_name || "",
    email: normEmail(incoming.email || customer.email),
    phone: incoming.phone || customer.phone || "",
    address_line1: incoming.address_line1 || "",
    address_line2: incoming.address_line2 || "",
    city: incoming.city || "",
    state_province: incoming.state_province || incoming.state || "",
    postal_code: incoming.postal_code || incoming.postalCode || "",
    country_code: String(incoming.country_code || incoming.country || "US").toUpperCase().slice(0, 2),
    isDefault: incoming.isDefault !== false,
  };
  const existing = customer.addresses.find((item) => sameStreet(item, payload));
  if (payload.isDefault) {
    customer.addresses.forEach((item) => {
      item.isDefault = false;
    });
  }
  if (existing) {
    Object.assign(existing, payload, { isDefault: payload.isDefault || existing.isDefault });
  } else {
    if (!customer.addresses.length) payload.isDefault = true;
    customer.addresses.push(payload);
  }
  return customer;
};

const upsertCustomer = async ({
  email,
  name,
  phone = "",
  type = "guest",
  user = null,
  address = null,
}) => {
  const nextEmail = normEmail(email);
  if (!nextEmail) return null;
  const nextName = String(name || nextEmail.split("@")[0] || "Customer").trim();
  let customer = await Customer.findOne({ email: nextEmail });
  if (!customer && user) {
    customer = await Customer.findOne({ user });
  }
  if (!customer) {
    customer = new Customer({
      name: nextName,
      email: nextEmail,
      phone,
      type: user ? "login" : type,
      user: user || null,
      addresses: [],
    });
  } else {
    if (nextName && nextName !== nextEmail.split("@")[0]) customer.name = nextName;
    if (phone) customer.phone = phone;
    if (user) {
      customer.user = user;
      customer.type = "login";
    }
  }
  if (address) mergeAddressOnto(customer, address);
  await customer.save();
  return customer;
};

const upsertCustomerFromUser = async (user) => {
  if (!user?._id || user.role !== "customer") return null;
  return upsertCustomer({
    email: user.email,
    name: user.name,
    phone: user.phone || "",
    type: "login",
    user: user._id,
  });
};

const upsertCustomerFromOrder = async ({ user, customerName, customerEmail, customerPhone, shipping_address, isGuest = false }) => {
  const email = normEmail(customerEmail || shipping_address?.email || user?.email);
  if (!email) return null;
  const name =
    customerName ||
    user?.name ||
    [shipping_address?.first_name, shipping_address?.last_name].filter(Boolean).join(" ").trim() ||
    "Customer";
  const loggedIn = Boolean(user) && !isGuest;
  return upsertCustomer({
    email,
    name,
    phone: customerPhone || shipping_address?.phone || user?.phone || "",
    type: loggedIn ? "login" : "guest",
    user: loggedIn ? user._id : null,
    address: shipping_address
      ? {
          ...shipping_address,
          phone: customerPhone || shipping_address.phone || "",
          email,
          label: shipping_address.label || "Home",
          isDefault: true,
        }
      : null,
  });
};

module.exports = {
  shortId,
  publicAddress,
  publicCustomer,
  upsertCustomer,
  upsertCustomerFromUser,
  upsertCustomerFromOrder,
  mergeAddressOnto,
  normEmail,
};
