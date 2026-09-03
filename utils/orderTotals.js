const { normalizeShippingAddress, withShippingAddress } = require("./orderAddress");

const round2 = (value) => Number((Number(value) || 0).toFixed(2));

const buildOrderTotals = ({
  subtotal = 0,
  shipping_total = 0,
  discount_total = 0,
  tax_total,
  taxRate,
  currency,
} = {}) => {
  const nextSubtotal = round2(subtotal);
  const nextShipping = round2(shipping_total);
  const nextDiscount = round2(discount_total);
  const rate = Number(taxRate);
  const nextTax =
    tax_total !== undefined && tax_total !== null && tax_total !== ""
      ? round2(tax_total)
      : round2(Math.max(0, nextSubtotal - nextDiscount) * (Number.isFinite(rate) ? rate : 0));
  const grand_total = round2(nextSubtotal + nextShipping + nextTax - nextDiscount);
  return {
    currency: currency || process.env.CURRENCY || "USD",
    subtotal: nextSubtotal,
    shipping_total: nextShipping,
    tax_total: nextTax,
    discount_total: nextDiscount,
    grand_total,
  };
};

const uniqueUrls = (urls) => [...new Set(urls.filter(Boolean))];

const withOrderItems = (data) => ({
  ...data,
  items: (data.items || []).map((item) => {
    const product = item.product && typeof item.product === "object" ? item.product : null;
    const image = item.image || product?.thumbnail || product?.images?.[0] || "";
    const images = uniqueUrls([image, product?.thumbnail, ...(product?.images || [])]);
    return {
      ...item,
      product: product?._id || item.product,
      productId: product?._id || item.product,
      sku: item.sku || product?.sku || "",
      name: item.name || product?.name || "",
      image,
      images,
    };
  }),
});

const pickAmount = (value, fallback) => {
  const primary = Number(value);
  const secondary = Number(fallback);
  if (value !== undefined && value !== null && value !== "" && !(primary === 0 && secondary > 0)) {
    return Number.isFinite(primary) ? primary : 0;
  }
  return Number.isFinite(secondary) ? secondary : 0;
};

const withOrderTotals = (order) => {
  const data = order && typeof order.toObject === "function" ? order.toObject() : { ...order };
  const totals = buildOrderTotals({
    subtotal: pickAmount(data.subtotal, data.itemsPrice),
    shipping_total: pickAmount(data.shipping_total, data.shippingPrice),
    discount_total: pickAmount(data.discount_total, data.couponDiscount),
    tax_total: data.tax_total,
    currency: data.currency,
  });
  return withOrderItems(
    withShippingAddress({
      ...data,
      ...totals,
      itemsPrice: data.itemsPrice ?? totals.subtotal,
      shippingPrice: data.shippingPrice ?? totals.shipping_total,
      couponDiscount: data.couponDiscount ?? totals.discount_total,
      totalPrice: data.totalPrice ?? totals.grand_total,
    })
  );
};

module.exports = { round2, buildOrderTotals, withOrderTotals, normalizeShippingAddress };
