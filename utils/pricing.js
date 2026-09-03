const clampDiscount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(100, amount);
};

const hasOwnDiscount = (product) =>
  product.discountPercent !== null &&
  product.discountPercent !== undefined &&
  product.discountPercent !== "";

const effectiveDiscount = (product) => {
  if (hasOwnDiscount(product)) return clampDiscount(product.discountPercent);
  return clampDiscount(product.category?.discountPercent);
};

const withPricing = (product) => {
  const data = product && typeof product.toObject === "function" ? product.toObject({ virtuals: true }) : { ...product };
  const discountPercent = effectiveDiscount(data);
  const originalPrice = Number(data.price) || 0;
  const salePrice = Number((originalPrice * (1 - discountPercent / 100)).toFixed(2));
  return {
    ...data,
    originalPrice,
    discountPercent,
    salePrice,
    discountSource: hasOwnDiscount(data) ? "product" : discountPercent > 0 ? "category" : "none",
  };
};

module.exports = { withPricing, effectiveDiscount };
