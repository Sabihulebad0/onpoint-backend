require("dotenv").config();

const connectDB = require("../config/db");
const Category = require("../models/Category");
const Product = require("../models/Product");

const migrate = async () => {
  await connectDB();
  await Category.updateMany({ type: { $exists: false } }, { $set: { type: "standard" } });
  await Product.updateMany({ type: { $exists: false } }, { $set: { type: "standard" } });

  const customCats = await Category.find({
    $or: [{ name: /custom/i }, { slug: /custom/i }],
  });
  for (const category of customCats) {
    category.type = "customizable";
    await category.save();
    await Product.updateMany({ category: category._id }, { $set: { type: "customizable" } });
    console.log(`Marked category as customizable: ${category.name}`);
  }

  console.log(`Customizable products: ${await Product.countDocuments({ type: "customizable" })}`);
  process.exit(0);
};

migrate().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
