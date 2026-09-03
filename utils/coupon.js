const Coupon = require("../models/Coupon");

const normalizeCode = (code) => String(code || "").trim().toUpperCase().replace(/\s+/g, "");

const parseCouponFields = (body = {}) => {
  const code = normalizeCode(body.couponCode ?? body.code);
  if (!code) return null;
  const type = body.couponType === "fixed" || body.type === "fixed" ? "fixed" : "percent";
  const amount = Number(body.couponAmount ?? body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Coupon amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }
  if (type === "percent" && amount > 100) {
    const error = new Error("Percent coupons cannot exceed 100");
    error.statusCode = 400;
    throw error;
  }
  return {
    code,
    type,
    amount,
    description: body.couponDescription || body.description || "",
  };
};

const productIdOf = (product) => String(product?._id || product?.id || product || "");
const categoryIdOf = (product) =>
  String(product?.category?._id || product?.category?.id || product?.category || "");

const itemEligible = (coupon, product) => {
  if (!coupon) return false;
  if (coupon.appliesTo === "all" || (!coupon.products?.length && !coupon.categories?.length)) {
    return true;
  }
  const productId = productIdOf(product);
  const categoryId = categoryIdOf(product);
  const productMatch = (coupon.products || []).some((id) => String(id) === productId);
  const categoryMatch = (coupon.categories || []).some((id) => String(id) === categoryId);
  if (coupon.appliesTo === "product") return productMatch;
  if (coupon.appliesTo === "category") return categoryMatch;
  return productMatch || categoryMatch;
};

const couponStatusError = (coupon, now = new Date()) => {
  if (!coupon || coupon.isActive === false) return "Coupon is not active";
  if (coupon.startsAt && now < new Date(coupon.startsAt)) return "Coupon is not active yet";
  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) return "Coupon has expired";
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return "Coupon usage limit reached";
  return null;
};

const applyCouponToPricedItems = (coupon, items) => {
  const statusError = couponStatusError(coupon);
  if (statusError) return { error: statusError, discount: 0, eligibleSubtotal: 0 };

  const eligibleSubtotal = items.reduce((sum, item) => {
    if (!itemEligible(coupon, item.product)) return sum;
    return sum + Number(item.unitPrice || 0) * Number(item.quantity || 0);
  }, 0);

  if (eligibleSubtotal <= 0) {
    return { error: "This coupon does not apply to items in the cart", discount: 0, eligibleSubtotal: 0 };
  }
  if (coupon.minOrderAmount > 0 && eligibleSubtotal < coupon.minOrderAmount) {
    return {
      error: `Minimum eligible amount for this coupon is $${Number(coupon.minOrderAmount).toFixed(2)}`,
      discount: 0,
      eligibleSubtotal,
    };
  }

  let discount =
    coupon.type === "fixed"
      ? Math.min(Number(coupon.amount) || 0, eligibleSubtotal)
      : eligibleSubtotal * ((Number(coupon.amount) || 0) / 100);
  if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  discount = Number(discount.toFixed(2));
  return { coupon, discount, eligibleSubtotal };
};

const findCouponByCode = (code) => Coupon.findOne({ code: normalizeCode(code) });

const evaluateCouponCode = async (code, items) => {
  const normalized = normalizeCode(code);
  if (!normalized) return { discount: 0, coupon: null };
  const coupon = await findCouponByCode(normalized);
  if (!coupon) return { error: "Invalid coupon code", discount: 0 };
  return applyCouponToPricedItems(coupon, items);
};

const couponsForTarget = async ({ productId, categoryId }) => {
  const or = [{ appliesTo: "all" }];
  if (productId) or.push({ products: productId });
  if (categoryId) or.push({ categories: categoryId });
  return Coupon.find({ isActive: true, $or: or }).sort({ code: 1 });
};

const upsertScopedCoupon = async ({ code, type, amount, description, appliesTo, productId, categoryId }) => {
  const normalized = normalizeCode(code);
  let coupon = await Coupon.findOne({ code: normalized });
  if (!coupon) {
    return Coupon.create({
      code: normalized,
      type,
      amount,
      description: description || "",
      appliesTo,
      products: productId ? [productId] : [],
      categories: categoryId ? [categoryId] : [],
      isActive: true,
    });
  }

  coupon.type = type;
  coupon.amount = amount;
  if (description) coupon.description = description;

  if (productId) {
    const id = String(productId);
    if (!(coupon.products || []).some((item) => String(item) === id)) coupon.products.push(productId);
    if (coupon.appliesTo === "all") {
      /* keep storewide */
    } else if (coupon.appliesTo === "category") {
      coupon.appliesTo = "all";
    } else {
      coupon.appliesTo = "product";
    }
  }
  if (categoryId) {
    const id = String(categoryId);
    if (!(coupon.categories || []).some((item) => String(item) === id)) coupon.categories.push(categoryId);
    if (coupon.appliesTo === "all") {
      /* keep storewide */
    } else if (coupon.appliesTo === "product") {
      coupon.appliesTo = "all";
    } else {
      coupon.appliesTo = "category";
    }
  }

  await coupon.save();
  return coupon;
};

module.exports = {
  normalizeCode,
  parseCouponFields,
  itemEligible,
  applyCouponToPricedItems,
  evaluateCouponCode,
  couponsForTarget,
  upsertScopedCoupon,
  findCouponByCode,
};
