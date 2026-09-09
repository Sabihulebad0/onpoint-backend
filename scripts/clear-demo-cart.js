require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");
const Cart = require("../models/Cart");

const clearDemoCart = async () => {
  await connectDB();
  const user = await User.findOne({ email: "client@onpoint.com" });
  if (!user) {
    console.log("Demo client not found");
    process.exit(1);
  }
  const result = await Cart.findOneAndUpdate(
    { user: user._id },
    { items: [], couponCode: "" },
    { new: true }
  );
  console.log(result ? "Demo client cart cleared" : "Demo client had no cart document");
  process.exit(0);
};

clearDemoCart().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
