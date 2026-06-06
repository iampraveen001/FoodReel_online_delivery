/**
 * Socket.IO Real-Time Service
 *
 * Rooms used:
 *   order_{orderId}       — customer + deliveryman + restaurant owner
 *   restaurant_{restId}   — restaurant owner, for new order alerts
 *   deliveryman_{userId}  — per deliveryman notifications
 *   customer_{userId}     — per customer notifications
 */

const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

const setupSocket = (io) => {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Authentication required"));

      const decoded = verifyToken(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user || !user.isActive) return next(new Error("User not found"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket;
    console.log(`🔌 Socket connected: ${user.name} (${user.role}) [${socket.id}]`);

    // Auto-join role-specific room
    socket.join(`${user.role}_${user._id}`);

    // ── JOIN ORDER ROOM ─────────────────────────────────
    // Both customer and deliveryman join order room to get live updates
    socket.on("join_order", (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`📦 ${user.name} joined order room: ${orderId}`);
    });

    socket.on("leave_order", (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // ── RESTAURANT OWNER ────────────────────────────────
    socket.on("join_restaurant", (restaurantId) => {
      if (user.role === "owner" || user.role === "admin") {
        socket.join(`restaurant_${restaurantId}`);
        console.log(`🍽️ Owner joined restaurant room: ${restaurantId}`);
      }
    });

    // ── DELIVERYMAN LOCATION BROADCAST ──────────────────
    // Deliveryman sends location → all listeners on order room get it
    socket.on("send_location", ({ orderId, lat, lng }) => {
      if (user.role !== "deliveryman") return;
      io.to(`order_${orderId}`).emit("location_update", { lat, lng, updatedAt: new Date() });
    });

    // ── DELIVERYMAN AVAILABILITY ─────────────────────────
    socket.on("set_availability", (isAvailable) => {
      if (user.role !== "deliveryman") return;
      User.findByIdAndUpdate(user._id, { "deliveryInfo.isAvailable": isAvailable }).exec();
      console.log(`🛵 ${user.name} is now ${isAvailable ? "available" : "unavailable"}`);
    });

    // ── CHAT / STATUS MESSAGES ───────────────────────────
    socket.on("order_message", ({ orderId, message }) => {
      io.to(`order_${orderId}`).emit("order_message", {
        from: { id: user._id, name: user.name, role: user.role },
        message,
        timestamp: new Date(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${user.name} [${socket.id}]`);
    });
  });
};

module.exports = setupSocket;
