require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { initStorage, storageMode } = require("./config/storage");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userRoutes = require("./routes/userRoutes");
const searchRoutes = require("./routes/searchRoutes");
const couponRoutes = require("./routes/couponRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "sports-ecommerce-api",
    storage: storageMode(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(errorHandler);

const start = async () => {
  try {
    await connectDB();
    await initStorage();
    const preferred = Number(process.env.PORT || 5000);
    const tryListen = (port) =>
      new Promise((resolve, reject) => {
        const server = app.listen(port, () => resolve(port));
        server.once("error", reject);
      });

    let port = preferred;
    try {
      await tryListen(port);
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      port = preferred + 1;
      await tryListen(port);
      console.log(`Port ${preferred} is in use`);
    }
    console.log(`Server running on port ${port}`);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

start();
