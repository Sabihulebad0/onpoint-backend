const ITEM_TYPES = ["standard", "customizable"];

const parseType = (value, fallback = "standard") => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return fallback;
  if (raw === "custom" || raw === "customise" || raw === "customize") return "customizable";
  return ITEM_TYPES.includes(raw) ? raw : fallback;
};

module.exports = { ITEM_TYPES, parseType };
