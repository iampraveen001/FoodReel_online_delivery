require('dotenv').config()
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const connectDB = require("./config/db");
const setupSocket = require("./services/socket");
const { error } = require("./utils/response");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const restaurantRoutes = require("./routes/restaurants");
const foodRoutes = require("./routes/food");
const orderRoutes = require("./routes/orders");
const deliveryRoutes = require("./routes/delivery");
const paymentRoutes = require("./routes/payment");

const app = express();
const httpServer = http.createServer(app);

const url = process.env.CLIENT_URL
// ── Socket.IO ─────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: url || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});
setupSocket(io);
app.set("io", io); // available in controllers via req.app.get("io")

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: url || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ── Routes ────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/deliveryman", deliveryRoutes);
app.use("/api/payment", paymentRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  error(res, `Route ${req.originalUrl} not found.`, 404);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err);
  error(res, err.message || "Internal server error", err.status || 500);
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 FoodReels API running on ${
      process.env.CLIENT_URL || `http://localhost`
    }:${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🌿 Env: ${process.env.NODE_ENV || "development"}\n`);
  });
});
