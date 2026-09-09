const Customer = require("../models/Customer");
const { publicAddress, upsertCustomer, mergeAddressOnto, normEmail } = require("../utils/customer");

const resolveCustomer = async (req) => {
  const email = normEmail(req.body?.email || req.query?.email || req.user?.email);
  if (req.user) {
    return upsertCustomer({
      email: req.user.email,
      name: req.user.name,
      phone: req.user.phone || "",
      type: "login",
      user: req.user._id,
    });
  }
  if (!email) {
    const error = new Error("Email is required to save an address");
    error.status = 400;
    throw error;
  }
  return upsertCustomer({
    email,
    name: [req.body?.first_name, req.body?.last_name].filter(Boolean).join(" ").trim() || email.split("@")[0],
    phone: req.body?.phone || "",
    type: "guest",
  });
};

const listAddresses = async (req, res, next) => {
  try {
    const email = normEmail(req.query?.email || req.user?.email);
    if (!req.user && !email) {
      return res.json({ addresses: [] });
    }
    const customer = req.user
      ? await Customer.findOne({ $or: [{ user: req.user._id }, { email: req.user.email }] })
      : await Customer.findOne({ email });
    res.json({ addresses: (customer?.addresses || []).map(publicAddress), email: customer?.email || email });
  } catch (error) {
    next(error);
  }
};

const createAddress = async (req, res, next) => {
  try {
    const customer = await resolveCustomer(req);
    if (!String(req.body.address_line1 || "").trim() || !String(req.body.city || "").trim()) {
      return res.status(400).json({ message: "Street address and city are required" });
    }
    mergeAddressOnto(customer, { ...req.body, email: customer.email, isDefault: req.body.isDefault !== false });
    await customer.save();
    const address = customer.addresses[customer.addresses.length - 1];
    const saved =
      customer.addresses.find(
        (item) =>
          String(item.address_line1) === String(req.body.address_line1 || "").trim() &&
          String(item.city) === String(req.body.city || "").trim()
      ) || address;
    res.status(201).json({ address: publicAddress(saved), addresses: customer.addresses.map(publicAddress) });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const customer = await resolveCustomer(req);
    const address = customer.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ message: "Address not found" });
    const fields = [
      "label",
      "first_name",
      "last_name",
      "email",
      "phone",
      "address_line1",
      "address_line2",
      "city",
      "state_province",
      "postal_code",
      "country_code",
    ];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) address[field] = req.body[field];
    });
    if (req.body.isDefault) {
      customer.addresses.forEach((item) => {
        item.isDefault = String(item._id) === String(address._id);
      });
    }
    await customer.save();
    res.json({ address: publicAddress(address), addresses: customer.addresses.map(publicAddress) });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
};

const setDefaultAddress = async (req, res, next) => {
  try {
    const customer = await resolveCustomer(req);
    const address = customer.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ message: "Address not found" });
    customer.addresses.forEach((item) => {
      item.isDefault = String(item._id) === String(address._id);
    });
    await customer.save();
    res.json({ addresses: customer.addresses.map(publicAddress) });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const customer = await resolveCustomer(req);
    const address = customer.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ message: "Address not found" });
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && customer.addresses[0]) customer.addresses[0].isDefault = true;
    await customer.save();
    res.json({ addresses: customer.addresses.map(publicAddress) });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
};

module.exports = {
  listAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
