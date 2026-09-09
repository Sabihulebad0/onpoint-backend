require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");
const Category = require("../models/Category");
const Attribute = require("../models/Attribute");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Notification = require("../models/Notification");
const { withPricing } = require("../utils/pricing");
const { upsertCustomerFromUser, upsertCustomerFromOrder } = require("../utils/customer");

const img = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const USERS = [
  {
    name: "Sports Admin",
    email: "admin@sports.com",
    password: "admin123",
    role: "admin",
    phone: "555-0101",
    emailVerified: true,
    address: { street: "1 Admin Way", city: "Austin", state: "TX", postalCode: "78701", country: "US" },
  },
  {
    name: "Maya Chen",
    email: "staff@sports.com",
    password: "staff123",
    role: "staff",
    permissions: ["products:write", "categories:write", "coupons:write", "orders:read"],
    phone: "555-0102",
    emailVerified: true,
    address: { street: "88 Warehouse Rd", city: "Austin", state: "TX", postalCode: "78702", country: "US" },
  },
  {
    name: "Delivery Boy",
    email: "delivery@sports.com",
    password: "delivery123",
    role: "delivery",
    phone: "555-0103",
    emailVerified: true,
    address: { street: "12 Dispatch Ln", city: "Austin", state: "TX", postalCode: "78703", country: "US" },
  },
  {
    name: "Demo Client",
    email: "client@onpoint.com",
    password: "Client@123",
    role: "customer",
    phone: "555-0100",
    emailVerified: true,
    address: { street: "240 Riverside Dr", city: "Austin", state: "TX", postalCode: "78704", country: "US" },
  },
  {
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    password: "customer123",
    role: "customer",
    phone: "555-0148",
    emailVerified: true,
    address: { street: "128 Harbor Lane", city: "Austin", state: "TX", postalCode: "78701", country: "US" },
  },
  {
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    password: "customer123",
    role: "customer",
    phone: "555-0162",
    emailVerified: true,
    address: { street: "41 Maple Court", city: "Dallas", state: "TX", postalCode: "75201", country: "US" },
  },
];

const CATEGORIES = [
  { name: "Jerseys", slug: "jerseys", description: "Match and training jerseys", type: "standard", discountPercent: 0, icon: "shirt" },
  { name: "Shorts", slug: "shorts", description: "Performance shorts", type: "standard", discountPercent: 5, icon: "fitness" },
  { name: "Footwear", slug: "footwear", description: "Court and turf shoes", type: "standard", discountPercent: 0, icon: "walk" },
  { name: "Accessories", slug: "accessories", description: "Socks, caps, and bags", type: "standard", discountPercent: 10, icon: "bag" },
  { name: "Custom Tees", slug: "custom-tees", description: "Blank tees for studio artwork", type: "customizable", discountPercent: 0, icon: "color-wand" },
  { name: "Custom Kits", slug: "custom-kits", description: "Team kits you can customize", type: "customizable", discountPercent: 0, icon: "people" },
];

const ATTRIBUTES = [
  { title: "Size", displayName: "Size", option: "dropdown", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { title: "Color", displayName: "Color", option: "radio", values: ["Black", "White", "Navy", "Red", "Green"] },
  { title: "Fit", displayName: "Fit", option: "dropdown", values: ["Regular", "Slim", "Relaxed"] },
];

const PRODUCTS = [
  {
    sku: "OP-JERSEY-01",
    name: "Pro Match Jersey",
    slug: "pro-match-jersey",
    categorySlug: "jerseys",
    type: "standard",
    sport: "Soccer",
    brand: "On Point",
    tags: ["match", "pro", "breathable"],
    shortDescription: "Lightweight match jersey with moisture-wicking knit.",
    description: "Built for full 90-minute matches. Mesh panels, taped seams, and a classic athletic cut.",
    price: 64,
    discountPercent: 10,
    stock: 48,
    weight: 0.22,
    featured: true,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Navy", "White", "Red"],
    thumbnail: img("photo-1579952363873-27f3bade9f55"),
    images: [img("photo-1579952363873-27f3bade9f55"), img("photo-1431324155629-1a6deb1dec8d")],
  },
  {
    sku: "OP-SHORT-01",
    name: "Training Shorts",
    slug: "training-shorts",
    categorySlug: "shorts",
    type: "standard",
    sport: "Training",
    brand: "On Point",
    tags: ["training", "stretch"],
    shortDescription: "Four-way stretch shorts for drills and gym work.",
    description: "Elastic waist, side pockets, and a split hem so you can move freely on the court or pitch.",
    price: 32,
    discountPercent: null,
    stock: 80,
    featured: false,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "Navy", "Grey"],
    thumbnail: img("photo-1591195853828-11db59a44f6b"),
    images: [img("photo-1591195853828-11db59a44f6b")],
  },
  {
    sku: "OP-SHOE-01",
    name: "Court Runner",
    slug: "court-runner",
    categorySlug: "footwear",
    type: "standard",
    sport: "Basketball",
    brand: "On Point",
    tags: ["court", "cushion"],
    shortDescription: "Cushioned court shoe with a grippy outsole.",
    description: "Stable heel, padded collar, and a rubber outsole made for indoor hardwood.",
    price: 118,
    discountPercent: 15,
    stock: 26,
    featured: true,
    sizes: ["8", "9", "10", "11", "12"],
    colors: ["Black", "White"],
    thumbnail: img("photo-1542291026-7eec264c27ff"),
    images: [img("photo-1542291026-7eec264c27ff"), img("photo-1460353581641-37baddab0fa2")],
  },
  {
    sku: "OP-SOCK-01",
    name: "Crew Performance Socks",
    slug: "crew-performance-socks",
    categorySlug: "accessories",
    type: "standard",
    sport: "All",
    brand: "On Point",
    tags: ["socks", "pack"],
    shortDescription: "Cushioned crew socks sold as a 3-pack.",
    description: "Arch support, padded sole, and a stay-up cuff. Pack of three pairs.",
    price: 18,
    discountPercent: null,
    stock: 120,
    featured: false,
    sizes: ["M", "L"],
    colors: ["White", "Black"],
    thumbnail: img("photo-1586350977771-b3b0abd50c37"),
    images: [img("photo-1586350977771-b3b0abd50c37")],
  },
  {
    sku: "OP-HOOD-01",
    name: "Sideline Hoodie",
    slug: "sideline-hoodie",
    categorySlug: "accessories",
    type: "standard",
    sport: "Lifestyle",
    brand: "On Point",
    tags: ["hoodie", "warm"],
    shortDescription: "Heavyweight hoodie for warm-ups and travel.",
    description: "Brushed fleece, kangaroo pocket, and a ribbed hem. Easy layer over a jersey.",
    price: 72,
    discountPercent: 0,
    stock: 34,
    featured: true,
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Grey", "Navy", "Black"],
    thumbnail: img("photo-1556821840-3a63f95609a7"),
    images: [img("photo-1556821840-3a63f95609a7")],
  },
  {
    sku: "OP-TEE-C01",
    name: "Custom Practice Tee",
    slug: "custom-practice-tee",
    categorySlug: "custom-tees",
    type: "customizable",
    sport: "Training",
    brand: "On Point",
    tags: ["custom", "tee", "studio"],
    shortDescription: "Blank cotton-blend tee ready for logos in the studio.",
    description: "Smooth print area on chest and back. Use Customize Your Own to place artwork, then save the design.",
    price: 28,
    discountPercent: 0,
    stock: 200,
    featured: true,
    sizes: ["S", "M", "L", "XL"],
    colors: ["White", "Black", "Navy", "Red"],
    thumbnail: img("photo-1521572163474-6864f9cf17ab"),
    images: [img("photo-1521572163474-6864f9cf17ab"), img("photo-1503341455253-b2e723bb1395")],
  },
  {
    sku: "OP-JSY-C01",
    name: "Custom Match Jersey",
    slug: "custom-match-jersey",
    categorySlug: "custom-kits",
    type: "customizable",
    sport: "Soccer",
    brand: "On Point",
    tags: ["custom", "jersey", "team"],
    shortDescription: "Sublimated-ready jersey for club and school kits.",
    description: "Add a crest, sponsor, or player name in the custom studio. Lightweight polyester with a dry-fit knit.",
    price: 54,
    discountPercent: 5,
    stock: 90,
    featured: true,
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["White", "Navy", "Green", "Red"],
    thumbnail: img("photo-1517466787929-bc90951d0974"),
    images: [img("photo-1517466787929-bc90951d0974"), img("photo-1579952363873-27f3bade9f55")],
  },
  {
    sku: "OP-KIT-C01",
    name: "Custom Team Kit Shirt",
    slug: "custom-team-kit-shirt",
    categorySlug: "custom-kits",
    type: "customizable",
    sport: "Basketball",
    brand: "On Point",
    tags: ["custom", "kit", "basketball"],
    shortDescription: "Reversible-look kit shirt with a large print zone.",
    description: "Designed for school and rec teams. Customize color, logo placement, and scale before adding to cart.",
    price: 46,
    discountPercent: 0,
    stock: 70,
    featured: false,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "White", "Navy"],
    thumbnail: img("photo-1546519638-68e109498ffc"),
    images: [img("photo-1546519638-68e109498ffc")],
  },
];

const upsertUser = async (data) => {
  let user = await User.findOne({ email: data.email }).select("+password");
  if (!user) {
    user = await User.create(data);
    return { user, created: true };
  }
  user.name = data.name;
  user.role = data.role;
  user.phone = data.phone;
  user.emailVerified = data.emailVerified;
  user.isActive = true;
  user.permissions = data.permissions || [];
  user.address = data.address;
  await user.save();
  return { user, created: false };
};

const upsertCategory = async (data) => {
  const next = await Category.findOneAndUpdate(
    { slug: data.slug },
    { $set: data },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return next;
};

const upsertAttribute = async ({ title, displayName, option, values }) => {
  let attr = await Attribute.findOne({ title });
  const mapped = values.map((name) => ({ name, isActive: true }));
  if (!attr) {
    attr = await Attribute.create({ title, displayName, option, values: mapped, isActive: true });
    return attr;
  }
  attr.displayName = displayName;
  attr.option = option;
  attr.isActive = true;
  const existing = new Map(attr.values.map((value) => [value.name.toLowerCase(), value]));
  for (const name of values) {
    if (!existing.has(name.toLowerCase())) attr.values.push({ name, isActive: true });
  }
  await attr.save();
  return attr;
};

const optionFor = (attr, name) => {
  const value = attr.values.find((item) => item.name.toLowerCase() === name.toLowerCase());
  return {
    attribute: attr._id,
    attributeTitle: attr.title,
    valueId: value?._id,
    value: name,
  };
};

const upsertProduct = async (data, categories, attributes) => {
  const category = categories.get(data.categorySlug);
  const payload = {
    ...data,
    category: category._id,
    type: data.type || category.type || "standard",
    barcode: `200${data.sku.replace(/\D/g, "").padStart(10, "0").slice(-10)}`,
    compareAtPrice: data.discountPercent ? Number((data.price * 1.15).toFixed(2)) : undefined,
    width: 12,
    height: 16,
    volume: 0.4,
    storage: "local",
    isActive: true,
    seo: {
      title: `${data.name} | On Point`,
      description: data.shortDescription,
      keywords: data.tags.join(", "),
    },
  };
  delete payload.categorySlug;

  if (data.sku === "OP-JERSEY-01") {
    const size = attributes.get("Size");
    const color = attributes.get("Color");
    payload.hasVariants = true;
    payload.attributes = [size._id, color._id];
    payload.variants = [
      {
        options: [optionFor(size, "M"), optionFor(color, "Navy")],
        sku: "OP-JERSEY-01-M-NAVY",
        price: 64,
        salePrice: 57.6,
        stock: 12,
        image: payload.thumbnail,
        isActive: true,
      },
      {
        options: [optionFor(size, "L"), optionFor(color, "White")],
        sku: "OP-JERSEY-01-L-WHITE",
        price: 64,
        salePrice: 57.6,
        stock: 10,
        image: payload.thumbnail,
        isActive: true,
      },
    ];
  }

  const existing = await Product.findOne({ sku: data.sku });
  if (!existing) return Product.create(payload);
  Object.assign(existing, payload);
  await existing.save();
  return existing;
};

const upsertCoupon = async (data) => {
  const existing = await Coupon.findOne({ code: data.code });
  if (!existing) return Coupon.create(data);
  Object.assign(existing, data);
  await existing.save();
  return existing;
};

const line = (product, quantity, extra = {}) => {
  const priced = withPricing(product);
  return {
    product: product._id,
    name: product.name,
    sku: product.sku || "",
    image: product.thumbnail || product.images?.[0] || "",
    quantity,
    price: priced.salePrice,
    size: extra.size || product.sizes?.[0] || "M",
    color: extra.color || product.colors?.[0] || "",
    custom: Boolean(extra.custom),
  };
};

const totalsFor = (items, extra = {}) => {
  const itemsPrice = Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
  const couponDiscount = Number(extra.couponDiscount || 0);
  const shippingPrice = extra.shippingPrice != null ? extra.shippingPrice : itemsPrice >= 100 ? 0 : 8;
  const tax_total = Number(extra.tax_total || 0);
  const totalPrice = Number((Math.max(0, itemsPrice - couponDiscount) + shippingPrice + tax_total).toFixed(2));
  return {
    itemsPrice,
    couponCode: extra.couponCode || "",
    couponDiscount,
    shippingPrice,
    tax_total,
    taxRate: extra.taxRate || 0,
    taxState: extra.taxState || "TX",
    subtotal: itemsPrice,
    shipping_total: shippingPrice,
    discount_total: couponDiscount,
    grand_total: totalPrice,
    totalPrice,
    currency: "USD",
  };
};

const seed = async () => {
  await connectDB();

  const users = new Map();
  for (const row of USERS) {
    const { user, created } = await upsertUser(row);
    users.set(row.email, user);
    console.log(`${created ? "Created" : "Updated"} user ${row.email} (${row.role})`);
  }

  const categories = new Map();
  for (const row of CATEGORIES) {
    const category = await upsertCategory(row);
    categories.set(row.slug, category);
    console.log(`Category ${category.slug} (${category.type})`);
  }

  const attributes = new Map();
  for (const row of ATTRIBUTES) {
    const attr = await upsertAttribute(row);
    attributes.set(row.title, attr);
    console.log(`Attribute ${attr.title} (${attr.values.length} values)`);
  }

  const products = new Map();
  for (const row of PRODUCTS) {
    const product = await upsertProduct(row, categories, attributes);
    products.set(row.sku, product);
    console.log(`Product ${product.sku} · ${product.type}`);
  }

  const customCategory = categories.get("custom-tees");
  const customJersey = products.get("OP-JSY-C01");
  const coupons = [
    await upsertCoupon({
      code: "WELCOME10",
      name: "Welcome 10%",
      description: "10% off your first order",
      type: "percent",
      amount: 10,
      appliesTo: "all",
      minOrderAmount: 0,
      maxDiscount: 25,
      usageLimit: 500,
      usedCount: 12,
      startsAt: new Date("2026-01-01"),
      expiresAt: new Date("2027-12-31"),
      isActive: true,
    }),
    await upsertCoupon({
      code: "DESIGN50",
      name: "Custom studio 50%",
      description: "Half off customizable tees and kits",
      type: "percent",
      amount: 50,
      appliesTo: "category",
      categories: [customCategory._id, categories.get("custom-kits")._id],
      minOrderAmount: 20,
      maxDiscount: 40,
      usageLimit: 200,
      usedCount: 4,
      startsAt: new Date("2026-01-01"),
      expiresAt: new Date("2027-12-31"),
      isActive: true,
    }),
    await upsertCoupon({
      code: "SAVE15",
      name: "$15 off $80+",
      description: "Fixed $15 discount on orders of $80 or more",
      type: "fixed",
      amount: 15,
      appliesTo: "all",
      minOrderAmount: 80,
      maxDiscount: 15,
      usageLimit: 1000,
      usedCount: 31,
      startsAt: new Date("2026-01-01"),
      expiresAt: new Date("2027-06-30"),
      isActive: true,
    }),
    await upsertCoupon({
      code: "TEAM20",
      name: "Team jersey 20%",
      description: "20% off the custom match jersey",
      type: "percent",
      amount: 20,
      appliesTo: "product",
      products: [customJersey._id],
      minOrderAmount: 0,
      maxDiscount: 20,
      usageLimit: 80,
      usedCount: 2,
      startsAt: new Date("2026-01-01"),
      expiresAt: new Date("2027-12-31"),
      isActive: true,
    }),
  ];
  coupons.forEach((coupon) => console.log(`Coupon ${coupon.code}`));

  const client = users.get("client@onpoint.com");
  const alex = users.get("alex.rivera@example.com");
  const jordan = users.get("jordan.lee@example.com");
  const admin = users.get("admin@sports.com");
  const delivery = users.get("delivery@sports.com");
  const tee = products.get("OP-TEE-C01");
  const jersey = products.get("OP-JERSEY-01");
  const shorts = products.get("OP-SHORT-01");
  const shoes = products.get("OP-SHOE-01");
  const hoodie = products.get("OP-HOOD-01");
  const kit = products.get("OP-KIT-C01");

  const existingCart = await Cart.findOne({ user: client._id });
  if (!existingCart || !existingCart.items?.length) {
    await Cart.findOneAndUpdate(
      { user: client._id },
      {
        items: [
          { product: tee._id, quantity: 1, size: "M", color: "White", custom: true },
          { product: shorts._id, quantity: 2, size: "M", color: "Black", custom: false },
        ],
        couponCode: "WELCOME10",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("Seeded demo client cart");
  } else {
    console.log("Demo client cart already has items — left as-is");
  }

  const seedOrderEmails = [client.email, alex.email, jordan.email, "guest.fan@example.com"];
  const existingStatuses = new Set(
    (await Order.find({ customerEmail: { $in: seedOrderEmails } }).select("status isGuest").lean()).map(
      (order) => (order.isGuest ? "guest" : order.status)
    )
  );

  const pendingItems = [line(tee, 1, { size: "M", color: "White", custom: true })];
  const paidItems = [line(jersey, 2, { size: "L", color: "Navy" }), line(shorts, 1, { size: "L", color: "Black" })];
  const shippedItems = [line(shoes, 1, { size: "10", color: "Black" })];
  const deliveredItems = [line(hoodie, 1, { size: "M", color: "Grey" }), line(products.get("OP-SOCK-01"), 2, { size: "M", color: "White" })];
  const guestItems = [line(kit, 3, { size: "L", color: "Navy", custom: true })];
  const paidTotals = totalsFor(paidItems, { couponCode: "WELCOME10", couponDiscount: 11.52, shippingPrice: 0 });
  const guestTotals = totalsFor(guestItems, { couponCode: "DESIGN50", couponDiscount: 20.7, shippingPrice: 8 });

  const orderBlueprints = [
    {
      key: "pending",
      doc: {
        user: client._id,
        items: pendingItems,
        shipping_address: {
          first_name: "Demo",
          last_name: "Client",
          address_line1: "240 Riverside Dr",
          city: "Austin",
          state_province: "TX",
          postal_code: "78704",
          country_code: "US",
        },
        shippingAddress: { street: "240 Riverside Dr", city: "Austin", state: "TX", postalCode: "78704", country: "US", phone: "555-0100" },
        customerName: client.name,
        customerEmail: client.email,
        customerPhone: client.phone,
        paymentMethod: "cod",
        ...totalsFor(pendingItems),
        status: "pending",
        statusHistory: [{ status: "pending", at: new Date(), by: client._id }],
      },
    },
    {
      key: "paid",
      doc: {
        user: alex._id,
        items: paidItems,
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
        shippingAddress: { street: "128 Harbor Lane", city: "Austin", state: "TX", postalCode: "78701", country: "US", phone: "555-0148" },
        customerName: alex.name,
        customerEmail: alex.email,
        customerPhone: alex.phone,
        paymentMethod: "card",
        ...paidTotals,
        status: "paid",
        statusHistory: [
          { status: "pending", at: new Date(Date.now() - 86400000 * 3), by: alex._id },
          { status: "paid", at: new Date(Date.now() - 86400000 * 2), by: admin._id },
        ],
      },
    },
    {
      key: "shipped",
      doc: {
        user: jordan._id,
        items: shippedItems,
        shipping_address: {
          first_name: "Jordan",
          last_name: "Lee",
          address_line1: "41 Maple Court",
          city: "Dallas",
          state_province: "TX",
          postal_code: "75201",
          country_code: "US",
        },
        shippingAddress: { street: "41 Maple Court", city: "Dallas", state: "TX", postalCode: "75201", country: "US", phone: "555-0162" },
        customerName: jordan.name,
        customerEmail: jordan.email,
        customerPhone: jordan.phone,
        paymentMethod: "card",
        ...totalsFor(shippedItems, { shippingPrice: 0 }),
        status: "shipped",
        assignedTo: delivery._id,
        trackingId: "OPTRACK-48291",
        statusHistory: [
          { status: "paid", at: new Date(Date.now() - 86400000 * 5), by: admin._id },
          { status: "shipped", at: new Date(Date.now() - 86400000), by: delivery._id },
        ],
      },
    },
    {
      key: "delivered",
      doc: {
        user: client._id,
        items: deliveredItems,
        shipping_address: {
          first_name: "Demo",
          last_name: "Client",
          address_line1: "240 Riverside Dr",
          city: "Austin",
          state_province: "TX",
          postal_code: "78704",
          country_code: "US",
        },
        shippingAddress: { street: "240 Riverside Dr", city: "Austin", state: "TX", postalCode: "78704", country: "US", phone: "555-0100" },
        customerName: client.name,
        customerEmail: client.email,
        customerPhone: client.phone,
        paymentMethod: "cod",
        ...totalsFor(deliveredItems, { couponCode: "SAVE15", couponDiscount: 15, shippingPrice: 0 }),
        status: "delivered",
        assignedTo: delivery._id,
        trackingId: "OPTRACK-19044",
        deliveredAt: new Date(Date.now() - 86400000 * 2),
        statusHistory: [
          { status: "paid", at: new Date(Date.now() - 86400000 * 8), by: admin._id },
          { status: "shipped", at: new Date(Date.now() - 86400000 * 5), by: delivery._id },
          { status: "delivered", at: new Date(Date.now() - 86400000 * 2), by: delivery._id },
        ],
      },
    },
    {
      key: "guest",
      doc: {
        user: null,
        isGuest: true,
        guestToken: "guest-seed-token-onpoint",
        items: guestItems,
        shipping_address: {
          first_name: "Sam",
          last_name: "Guest",
          address_line1: "9 Pine Street",
          city: "Houston",
          state_province: "TX",
          postal_code: "77002",
          country_code: "US",
        },
        shippingAddress: { street: "9 Pine Street", city: "Houston", state: "TX", postalCode: "77002", country: "US", phone: "555-0199" },
        customerName: "Sam Guest",
        customerEmail: "guest.fan@example.com",
        customerPhone: "555-0199",
        paymentMethod: "cod",
        ...guestTotals,
        status: "pending",
        statusHistory: [{ status: "pending", at: new Date() }],
      },
    },
  ];

  const ordersToInsert = orderBlueprints.filter((row) => !existingStatuses.has(row.key)).map((row) => row.doc);
  if (ordersToInsert.length) {
    await Order.insertMany(ordersToInsert);
    console.log(`Seeded ${ordersToInsert.length} sample orders`);
  } else {
    console.log("Sample orders already exist for each status — left as-is");
  }

  const noteCount = await Notification.countDocuments({ user: { $in: [client._id, admin._id] } });
  if (noteCount === 0) {
    await Notification.insertMany([
      {
        user: client._id,
        title: "Welcome to On Point",
        message: "Your account is ready. Customize a tee and save it to My Designs.",
        type: "system",
        audience: "customer",
        link: "/account",
        createdBy: admin._id,
        isRead: false,
      },
      {
        user: client._id,
        title: "Order delivered",
        message: "Your sideline hoodie has been delivered. Enjoy the kit.",
        type: "order",
        audience: "customer",
        link: "/orders",
        meta: { status: "delivered" },
        createdBy: delivery._id,
        isRead: true,
        readAt: new Date(),
      },
      {
        user: client._id,
        title: "DESIGN50 is live",
        message: "Take 50% off customizable tees and kits this season.",
        type: "coupon",
        audience: "customer",
        link: "/shop",
        meta: { code: "DESIGN50" },
        createdBy: admin._id,
        isRead: false,
      },
      {
        user: admin._id,
        title: "New guest order",
        message: "Sam Guest placed a custom kit order awaiting payment.",
        type: "order",
        audience: "admin",
        link: "/orders",
        createdBy: admin._id,
        isRead: false,
      },
      {
        user: admin._id,
        title: "Low stock watch",
        message: "Court Runner is down to 26 pairs. Consider restocking.",
        type: "product",
        audience: "admin",
        link: "/products",
        createdBy: admin._id,
        isRead: false,
      },
    ]);
    console.log("Seeded notifications");
  } else {
    console.log("Notifications already exist — left as-is");
  }

  const shoppers = await User.find({ role: "customer" });
  for (const shopper of shoppers) {
    await upsertCustomerFromUser(shopper);
  }
  const allOrders = await Order.find({});
  for (const order of allOrders) {
    const customer = await upsertCustomerFromOrder({
      user: order.user ? await User.findById(order.user) : null,
      isGuest: Boolean(order.isGuest) || !order.user,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shipping_address: {
        ...(order.shipping_address || {}),
        phone: order.customerPhone || order.shippingAddress?.phone || "",
        email: order.customerEmail,
      },
    });
    if (customer && !order.customer) {
      order.customer = customer._id;
      await order.save();
    }
  }
  console.log(`Customers synced from ${shoppers.length} accounts and ${allOrders.length} orders`);

  console.log("\nDummy data ready.");
  console.log("Admin     admin@sports.com / admin123");
  console.log("Staff     staff@sports.com / staff123");
  console.log("Delivery  delivery@sports.com / delivery123");
  console.log("Client    client@onpoint.com / Client@123");
  console.log("Coupons   WELCOME10, DESIGN50, SAVE15, TEAM20");
  process.exit(0);
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
