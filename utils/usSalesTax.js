const US_STATE_TAX = {
  AL: { name: "Alabama", rate: 0.0929 },
  AK: { name: "Alaska", rate: 0.0176 },
  AZ: { name: "Arizona", rate: 0.084 },
  AR: { name: "Arkansas", rate: 0.0947 },
  CA: { name: "California", rate: 0.0885 },
  CO: { name: "Colorado", rate: 0.0777 },
  CT: { name: "Connecticut", rate: 0.0635 },
  DE: { name: "Delaware", rate: 0 },
  DC: { name: "District of Columbia", rate: 0.06 },
  FL: { name: "Florida", rate: 0.0701 },
  GA: { name: "Georgia", rate: 0.0735 },
  HI: { name: "Hawaii", rate: 0.0444 },
  ID: { name: "Idaho", rate: 0.0602 },
  IL: { name: "Illinois", rate: 0.0881 },
  IN: { name: "Indiana", rate: 0.07 },
  IA: { name: "Iowa", rate: 0.0694 },
  KS: { name: "Kansas", rate: 0.0874 },
  KY: { name: "Kentucky", rate: 0.06 },
  LA: { name: "Louisiana", rate: 0.0955 },
  ME: { name: "Maine", rate: 0.055 },
  MD: { name: "Maryland", rate: 0.06 },
  MA: { name: "Massachusetts", rate: 0.0625 },
  MI: { name: "Michigan", rate: 0.06 },
  MN: { name: "Minnesota", rate: 0.0749 },
  MS: { name: "Mississippi", rate: 0.0706 },
  MO: { name: "Missouri", rate: 0.0829 },
  MT: { name: "Montana", rate: 0 },
  NE: { name: "Nebraska", rate: 0.0694 },
  NV: { name: "Nevada", rate: 0.0823 },
  NH: { name: "New Hampshire", rate: 0 },
  NJ: { name: "New Jersey", rate: 0.066 },
  NM: { name: "New Mexico", rate: 0.0783 },
  NY: { name: "New York", rate: 0.0852 },
  NC: { name: "North Carolina", rate: 0.0698 },
  ND: { name: "North Dakota", rate: 0.0696 },
  OH: { name: "Ohio", rate: 0.0723 },
  OK: { name: "Oklahoma", rate: 0.0898 },
  OR: { name: "Oregon", rate: 0 },
  PA: { name: "Pennsylvania", rate: 0.0634 },
  RI: { name: "Rhode Island", rate: 0.07 },
  SC: { name: "South Carolina", rate: 0.0746 },
  SD: { name: "South Dakota", rate: 0.0611 },
  TN: { name: "Tennessee", rate: 0.0955 },
  TX: { name: "Texas", rate: 0.082 },
  UT: { name: "Utah", rate: 0.0719 },
  VT: { name: "Vermont", rate: 0.0636 },
  VA: { name: "Virginia", rate: 0.0575 },
  WA: { name: "Washington", rate: 0.0938 },
  WV: { name: "West Virginia", rate: 0.0657 },
  WI: { name: "Wisconsin", rate: 0.0543 },
  WY: { name: "Wyoming", rate: 0.0536 },
};

const NAME_TO_CODE = Object.fromEntries(
  Object.entries(US_STATE_TAX).flatMap(([code, info]) => [
    [info.name.toUpperCase(), code],
    [code, code],
  ])
);

const normalizeStateCode = (value) => {
  const raw = String(value || "")
    .trim()
    .replace(/\./g, "")
    .toUpperCase();
  if (!raw) return "";
  if (US_STATE_TAX[raw]) return raw;
  return NAME_TO_CODE[raw] || "";
};

const salesTaxForAddress = (address = {}) => {
  const country = String(address.country_code || address.country || "US")
    .trim()
    .toUpperCase();
  const isUS = country === "US" || country === "USA" || country === "UNITED STATES";
  if (!isUS) {
    return { code: "", name: "", rate: 0 };
  }
  const code = normalizeStateCode(address.state_province || address.state);
  const info = US_STATE_TAX[code];
  if (!info) return { code: "", name: "", rate: 0 };
  return { code, name: info.name, rate: info.rate };
};

const US_STATES = Object.entries(US_STATE_TAX).map(([code, info]) => ({
  code,
  name: info.name,
  rate: info.rate,
}));

module.exports = { US_STATE_TAX, US_STATES, normalizeStateCode, salesTaxForAddress };
