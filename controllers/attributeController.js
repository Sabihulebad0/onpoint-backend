const Attribute = require("../models/Attribute");
const { ATTRIBUTE_OPTIONS } = require("../utils/attributeOptions");

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === "true" || value === "on" || value === "1";
};

const parseValues = (input) => {
  let raw = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (error) {
      raw = raw.split(",");
    }
  }
  if (!Array.isArray(raw)) return [];

  const seen = new Set();
  return raw
    .map((item) => (typeof item === "string" ? { name: item } : item || {}))
    .map((item) => ({
      _id: item._id || undefined,
      name: String(item.name || "").trim(),
      isActive: parseBoolean(item.isActive, true),
    }))
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (!item.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const buildPayload = (body) => {
  const title = String(body.title || body.name || "").trim();
  if (!title) throw badRequest("Attribute title is required");

  return {
    title,
    displayName: String(body.displayName || title).trim(),
    option: ATTRIBUTE_OPTIONS.includes(body.option) ? body.option : "dropdown",
    values: parseValues(body.values ?? body.variants),
    isActive: parseBoolean(body.isActive, true),
  };
};

const listAttributes = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.includeInactive !== "true") filter.isActive = true;
    if (req.query.search && String(req.query.search).trim()) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = new RegExp(escaped, "i");
    }
    if (ATTRIBUTE_OPTIONS.includes(req.query.option)) filter.option = req.query.option;

    const attributes = await Attribute.find(filter).sort({ createdAt: -1 });
    res.json(attributes);
  } catch (error) {
    next(error);
  }
};

const getAttribute = async (req, res, next) => {
  try {
    const attribute = await Attribute.findById(req.params.id);
    if (!attribute) return res.status(404).json({ message: "Attribute not found" });
    res.json(attribute);
  } catch (error) {
    next(error);
  }
};

const createAttribute = async (req, res, next) => {
  try {
    const payload = buildPayload(req.body);
    const exists = await Attribute.findOne({ title: new RegExp(`^${payload.title}$`, "i") });
    if (exists) {
      return res.status(409).json({ message: "An attribute with that title already exists" });
    }
    const attribute = await Attribute.create(payload);
    res.status(201).json(attribute);
  } catch (error) {
    next(error);
  }
};

const updateAttribute = async (req, res, next) => {
  try {
    const payload = buildPayload(req.body);
    const attribute = await Attribute.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!attribute) return res.status(404).json({ message: "Attribute not found" });
    res.json(attribute);
  } catch (error) {
    next(error);
  }
};

const deleteAttribute = async (req, res, next) => {
  try {
    const attribute = await Attribute.findByIdAndDelete(req.params.id);
    if (!attribute) return res.status(404).json({ message: "Attribute not found" });
    res.json({ message: "Attribute removed" });
  } catch (error) {
    next(error);
  }
};

const patchAttributeStatus = async (req, res, next) => {
  try {
    const attribute = await Attribute.findById(req.params.id);
    if (!attribute) return res.status(404).json({ message: "Attribute not found" });
    attribute.isActive = parseBoolean(req.body.isActive, !attribute.isActive);
    await attribute.save();
    res.json(attribute);
  } catch (error) {
    next(error);
  }
};

const bulkDeleteAttributes = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : [];
    if (!ids.length) return res.status(400).json({ message: "Select at least one attribute" });
    const result = await Attribute.deleteMany({ _id: { $in: ids } });
    res.json({ removed: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
};

const addAttributeValue = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Value name is required" });

    const attribute = await Attribute.findById(req.params.id);
    if (!attribute) return res.status(404).json({ message: "Attribute not found" });

    const duplicate = attribute.values.some(
      (value) => value.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      return res.status(409).json({ message: "That value already exists on this attribute" });
    }

    attribute.values.push({ name, isActive: parseBoolean(req.body.isActive, true) });
    await attribute.save();
    res.status(201).json(attribute);
  } catch (error) {
    next(error);
  }
};

const updateAttributeValue = async (req, res, next) => {
  try {
    const attribute = await Attribute.findById(req.params.id);
    if (!attribute) return res.status(404).json({ message: "Attribute not found" });

    const value = attribute.values.id(req.params.valueId);
    if (!value) return res.status(404).json({ message: "Attribute value not found" });

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ message: "Value name is required" });
      value.name = name;
    }
    if (req.body.isActive !== undefined) {
      value.isActive = parseBoolean(req.body.isActive, value.isActive);
    }

    await attribute.save();
    res.json(attribute);
  } catch (error) {
    next(error);
  }
};

const deleteAttributeValue = async (req, res, next) => {
  try {
    const attribute = await Attribute.findById(req.params.id);
    if (!attribute) return res.status(404).json({ message: "Attribute not found" });

    const value = attribute.values.id(req.params.valueId);
    if (!value) return res.status(404).json({ message: "Attribute value not found" });

    value.deleteOne();
    await attribute.save();
    res.json(attribute);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listAttributes,
  getAttribute,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  patchAttributeStatus,
  bulkDeleteAttributes,
  addAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
};
