require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");
const Category = require("../models/Category");

const seed = async () => {
  await connectDB();

  const email = "admin@sports.com";
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      name: "Sports Admin",
      email,
      password: "admin123",
      role: "admin",
    });
    console.log("Admin user created: admin@sports.com / admin123");
  } else if (existing.role !== "admin") {
    existing.role = "admin";
    await existing.save();
    console.log("Existing user promoted to admin:", email);
  } else {
    console.log("Admin user already exists:", email);
  }

  const deliveryEmail = "delivery@sports.com";
  const delivery = await User.findOne({ email: deliveryEmail });
  if (!delivery) {
    await User.create({
      name: "Delivery Boy",
      email: deliveryEmail,
      password: "delivery123",
      role: "delivery",
    });
    console.log("Delivery user created: delivery@sports.com / delivery123");
  } else if (delivery.role !== "delivery") {
    delivery.role = "delivery";
    await delivery.save();
    console.log("Existing user set as delivery:", deliveryEmail);
  } else {
    console.log("Delivery user already exists:", deliveryEmail);
  }

  const removed = await Category.deleteMany({});
  console.log(`Removed ${removed.deletedCount} categories`);
  process.exit(0);
};

seed().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
