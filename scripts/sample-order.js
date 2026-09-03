require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const { withPricing } = require("../utils/pricing");

const sample = async () => {
  await connectDB();

  let customer = await User.findOne({ email: "alex.rivera@example.com" });
  if (!customer) {
    customer = await User.create({
      name: "Alex Rivera",
      email: "alex.rivera@example.com",
      password: "customer123",
      role: "customer",
      phone: "555-0148",
    });
  }

  const product = await Product.findOne({ isActive: true }).populate("category", "name slug discountPercent");
  if (!product) {
    throw new Error("No active product found. Create a product first.");
  }

  const priced = withPricing(product);
  const quantity = 2;
  const itemsPrice = Number((priced.salePrice * quantity).toFixed(2));
  const coupon = await Coupon.findOne({ isActive: true, code: { $exists: true, $ne: "" } });
  let couponDiscount = 0;
  let couponCode = "";
  if (coupon) {
    couponCode = coupon.code;
    couponDiscount =
      coupon.type === "fixed"
        ? Math.min(Number(coupon.amount) || 0, itemsPrice)
        : Number((itemsPrice * ((Number(coupon.amount) || 0) / 100)).toFixed(2));
  }
  const shippingPrice = itemsPrice >= 100 ? 0 : 8;
  const totalPrice = Number((Math.max(0, itemsPrice - couponDiscount) + shippingPrice).toFixed(2));

  const order = await Order.create({
    user: customer._id,
    items: [
      {
        product: product._id,
        name: product.name,
        sku: product.sku || "",
        image: product.thumbnail || product.images?.[0] || "",
        quantity,
        price: priced.salePrice,
        size: product.sizes?.[0] || "M",
        color: product.colors?.[0] || "Black",
      },
    ],
    shipping_address: {
      first_name: "Alex",
      last_name: "Rivera",
      address_line1: "128 Harbor Lane",
      address_line2: "Suite 4B",
      city: "Austin",
      state_province: "TX",
      postal_code: "78701",
      country_code: "US",
    },
    shippingAddress: {
      street: "128 Harbor Lane",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
      phone: "555-0148",
    },
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    paymentMethod: "cod",
    itemsPrice,
    couponCode,
    couponDiscount,
    shippingPrice,
    totalPrice,
    status: "paid",
  });

  console.log(
    JSON.stringify(
      {
        orderId: order._id,
        customer: customer.email,
        product: product.name,
        qty: quantity,
        coupon: couponCode || null,
        total: totalPrice,
        status: order.status,
      },
      null,
      2
    )
  );
  process.exit(0);
};

sample().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
