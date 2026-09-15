require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const { initStorage, rewriteResponseMedia, storageMode, streamMedia } = require("./config/storage");
const errorHandler = require("./middleware/errorHandler");
const { attachChat } = require("./socket/chat");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userRoutes = require("./routes/userRoutes");
const customerRoutes = require("./routes/customerRoutes");
const addressRoutes = require("./routes/addressRoutes");
const searchRoutes = require("./routes/searchRoutes");
const couponRoutes = require("./routes/couponRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const contactRoutes = require("./routes/contactRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
attachChat(io);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => sendJson(rewriteResponseMedia(body));
  next();
});

app.get(/^\/api\/media\/(.+)$/, streamMedia);
app.head(/^\/api\/media\/(.+)$/, streamMedia);

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
app.use("/api/customers", customerRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/chat", chatRoutes);

app.use(errorHandler);

const start = async () => {
  try {
    await connectDB();
    await initStorage();
    const preferred = Number(process.env.PORT || 5000);
    const host = process.env.HOST || "0.0.0.0";
    const tryListen = (port) =>
      new Promise((resolve, reject) => {
        const onListen = () => {
          server.off("error", onError);
          resolve(port);
        };
        const onError = (error) => {
          server.off("listening", onListen);
          reject(error);
        };
        server.once("error", onError);
        server.listen(port, host, onListen);
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
    console.log(`Server running on http://${host}:${port}`);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

start();
