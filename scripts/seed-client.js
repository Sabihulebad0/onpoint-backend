require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");

const EMAIL = "client@onpoint.com";
const PASSWORD = "Client@123";

const seedClient = async () => {
  await connectDB();

  let user = await User.findOne({ email: EMAIL }).select("+password");
  if (!user) {
    user = await User.create({
      name: "Demo Client",
      email: EMAIL,
      password: PASSWORD,
      role: "customer",
      phone: "555-0100",
      emailVerified: true,
      isActive: true,
    });
    console.log("Client user created");
  } else {
    user.name = "Demo Client";
    user.role = "customer";
    user.password = PASSWORD;
    user.emailVerified = true;
    user.isActive = true;
    await user.save();
    console.log("Client user updated");
  }

  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  process.exit(0);
};

seedClient().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
