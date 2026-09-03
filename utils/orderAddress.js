const COUNTRY_CODES = {
  USA: "US",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  CANADA: "CA",
  AUSTRALIA: "AU",
  INDIA: "IN",
  PAKISTAN: "PK",
};

const splitName = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" "),
  };
};

const toCountryCode = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length === 2) return raw.toUpperCase();
  return COUNTRY_CODES[raw.toUpperCase()] || raw.slice(0, 2).toUpperCase();
};

const pick = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";

const normalizeShippingAddress = (input = {}, fallbackName = "") => {
  const names = splitName(fallbackName || `${input.first_name || ""} ${input.last_name || ""}`);
  const shipping_address = {
    first_name: pick(input.first_name, names.first_name),
    last_name: pick(input.last_name, names.last_name),
    address_line1: pick(input.address_line1, input.street),
    address_line2: pick(input.address_line2),
    city: pick(input.city),
    state_province: pick(input.state_province, input.state),
    postal_code: pick(input.postal_code, input.postalCode),
    country_code: toCountryCode(pick(input.country_code, input.country)),
  };
  return shipping_address;
};

const withShippingAddress = (data) => {
  const nested = data.shipping_address || {};
  const legacy = data.shippingAddress || {};
  const raw = {
    first_name: pick(nested.first_name, legacy.first_name),
    last_name: pick(nested.last_name, legacy.last_name),
    address_line1: pick(nested.address_line1, legacy.address_line1, legacy.street),
    address_line2: pick(nested.address_line2, legacy.address_line2),
    city: pick(nested.city, legacy.city),
    state_province: pick(nested.state_province, legacy.state_province, legacy.state),
    postal_code: pick(nested.postal_code, legacy.postal_code, legacy.postalCode),
    country_code: pick(nested.country_code, legacy.country_code, legacy.country),
  };
  const shipping_address = normalizeShippingAddress(
    raw,
    data.customerName || data.user?.name || ""
  );
  return {
    ...data,
    shipping_address,
    shippingAddress: {
      ...(data.shippingAddress || {}),
      street: shipping_address.address_line1,
      city: shipping_address.city,
      state: shipping_address.state_province,
      postalCode: shipping_address.postal_code,
      country: shipping_address.country_code,
      first_name: shipping_address.first_name,
      last_name: shipping_address.last_name,
      address_line1: shipping_address.address_line1,
      address_line2: shipping_address.address_line2,
      state_province: shipping_address.state_province,
      postal_code: shipping_address.postal_code,
      country_code: shipping_address.country_code,
    },
  };
};

module.exports = { normalizeShippingAddress, withShippingAddress, splitName, toCountryCode };
