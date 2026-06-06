const Order = require("../models/Order");
const FoodItem = require("../models/FoodItem");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const { success, error } = require("../utils/response");
const { findNearestDeliveryman } = require("../utils/location");

// ── CUSTOMER ────────────────────────────────────────────

// POST /api/orders
const placeOrder = async (req, res) => {
  try {
    const { restaurantId, items, deliveryAddress, paymentMethod, customerLocation } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return error(res, "Restaurant not found.", 400);
    }
    // Allow orders even if not yet approved by admin (dev-friendly)

    // Fetch items and calculate price
    const enrichedItems = [];
    let subtotal = 0;
    for (const { foodItemId, qty } of items) {
      const food = await FoodItem.findById(foodItemId);
      if (!food || !food.isAvailable) return error(res, `${food?.name || "Item"} is not available.`, 400);
      enrichedItems.push({ foodItem: food._id, name: food.name, price: food.price, qty });
      subtotal += food.price * qty;
    }

    // minOrderAmount check removed — let all orders through so they reach the restaurant

    const total = subtotal + restaurant.deliveryFee;

    const assignedDeliveryman = await User.findOne({ role: "deliveryman", "deliveryInfo.isAvailable": true });

    // Build customerLocation field — save GPS captured at order time if provided
    const customerLocationData =
      customerLocation?.lat && customerLocation?.lng
        ? { lat: customerLocation.lat, lng: customerLocation.lng, updatedAt: new Date() }
        : undefined;

    const order = await Order.create({
      customer: req.user._id,
      restaurant: restaurantId,
      deliveryman: assignedDeliveryman?._id || null,
      items: enrichedItems,
      deliveryAddress,
      ...(customerLocationData && { customerLocation: customerLocationData }),
      subtotal,
      deliveryFee: restaurant.deliveryFee,
      total,
      paymentMethod: paymentMethod || "cod",
      statusHistory: [
        { status: "pending", note: "Order placed by customer" },
        assignedDeliveryman ? { status: "assigned", note: `Assigned to ${assignedDeliveryman.name}` } : null,
      ].filter(Boolean),
    });

    // Notify restaurant via socket — populate fields so OwnerScreen can render without extra fetch
    const io = req.app.get("io");
    if (io) {
      const populatedOrder = await Order.findById(order._id)
        .populate("customer", "name phone")
        .populate("deliveryman", "name phone")
        .lean();

      console.log(`📨 Emitting new_order to restaurant_${restaurantId}`);
      io.to(`restaurant_${restaurantId}`).emit("new_order", populatedOrder);

      // Notify assigned deliveryman immediately so they can join the order room
      if (assignedDeliveryman) {
        io.to(`deliveryman_${assignedDeliveryman._id}`).emit("order_assigned", {
          orderId: order._id,
          customerLocation: customerLocationData || null,
        });
      }
    } else {
      console.warn("⚠️  Socket.IO not available — restaurant not notified in real-time");
    }

    return success(res, { order }, "Order placed successfully!", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// GET /api/orders/my  (customer)
const getMyOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { customer: req.user._id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate("restaurant", "name logo")
      .populate("deliveryman", "name phone deliveryInfo.currentLocation")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);
    return success(res, { orders, total });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/orders/:id  (customer / owner / deliveryman / admin)
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name phone")
      .populate("restaurant", "name logo address phone")
      .populate("deliveryman", "name phone deliveryInfo");

    if (!order) return error(res, "Order not found.", 404);

    // Access control
    const uid = String(req.user._id);
    const isCustomer = String(order.customer._id) === uid;
    const isDeliveryman = order.deliveryman && String(order.deliveryman._id) === uid;
    const isAdmin = req.user.role === "admin";
    // Owner check
    const restaurant = await Restaurant.findById(order.restaurant._id);
    const isOwner = restaurant && String(restaurant.owner) === uid;

    if (!isCustomer && !isDeliveryman && !isAdmin && !isOwner) {
      return error(res, "Access denied.", 403);
    }

    return success(res, { order });
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/orders/:id/cancel  (customer)
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
    if (!order) return error(res, "Order not found.", 404);

    const cancellable = ["pending", "confirmed"];
    if (!cancellable.includes(order.status)) {
      return error(res, "Order cannot be cancelled at this stage.", 400);
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancelReason = req.body.reason || "Cancelled by customer";
    order.statusHistory.push({ status: "cancelled", note: order.cancelReason });
    await order.save();

    const io = req.app.get("io");
    if (io) io.to(`order_${order._id}`).emit("order_update", { status: "cancelled" });

    return success(res, { order }, "Order cancelled.");
  } catch (err) {
    return error(res, err.message);
  }
};

// ── OWNER ────────────────────────────────────────────────

// GET /api/orders/restaurant/:restaurantId  (owner)
const getRestaurantOrders = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ _id: req.params.restaurantId, owner: req.user._id });
    if (!restaurant) return error(res, "Restaurant not found.", 404);

    const { status, page = 1, limit = 20 } = req.query;
    const query = { restaurant: req.params.restaurantId };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate("customer", "name phone")
      .populate("deliveryman", "name phone")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);
    return success(res, { orders, total });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/orders/:id/status  (owner) — confirm / preparing / ready
const updateOrderStatusByOwner = async (req, res) => {
  try {
    const { status } = req.body;
    const ownerAllowed = ["confirmed", "preparing", "ready", "cancelled"];

    if (!ownerAllowed.includes(status)) {
      return error(res, `Owner can only set: ${ownerAllowed.join(", ")}`, 400);
    }

    const order = await Order.findById(req.params.id).populate("restaurant");
    if (!order) return error(res, "Order not found.", 404);
    if (String(order.restaurant.owner) !== String(req.user._id)) {
      return error(res, "Unauthorized.", 403);
    }

    // If confirming order, find nearest available deliveryman
    let assignedDeliveryman = null;
    if (status === "confirmed" && !order.deliveryman) {
      const restaurant = order.restaurant;

      // Check if restaurant has location data
      if (restaurant.address && restaurant.address.lat && restaurant.address.lng) {
        assignedDeliveryman = await findNearestDeliveryman(
          restaurant.address.lat,
          restaurant.address.lng,
          10 // 10km radius
        );

        if (assignedDeliveryman) {
          order.deliveryman = assignedDeliveryman._id;
          order.statusHistory.push({
            status: "assigned",
            note: `Auto-assigned to ${assignedDeliveryman.name} (${assignedDeliveryman.distance}km away)`
          });
        }
      }
    }

    order.status = status;
    order.statusHistory.push({ status, note: `Updated by restaurant owner` });
    if (status === "confirmed") {
      order.estimatedDeliveryTime = new Date(Date.now() + 40 * 60 * 1000); // +40 min
    }
    await order.save();

    const io = req.app.get("io");
    if (io) {
      const updatePayload = {
        orderId: order._id,
        status,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        deliveryman: assignedDeliveryman ? {
          _id: assignedDeliveryman._id,
          name: assignedDeliveryman.name,
          distance: assignedDeliveryman.distance
        } : null,
      };
      // Notify customer + deliveryman in the order room
      io.to(`order_${order._id}`).emit("order_update", updatePayload);
      // Also notify the owner's restaurant room so OwnerScreen updates in real-time
      io.to(`restaurant_${order.restaurant._id}`).emit("order_update", updatePayload);
      if (status === "ready") io.emit("order_ready_for_pickup", { orderId: order._id, restaurantId: order.restaurant._id });
    }

    return success(res, { order }, `Order status updated to '${status}'.${assignedDeliveryman ? ` Assigned to ${assignedDeliveryman.name} (${assignedDeliveryman.distance}km away).` : ""}`);
  } catch (err) {
    return error(res, err.message);
  }
};

// ── DELIVERYMAN ───────────────────────────────────────────

// GET /api/orders/available  (deliveryman) — orders ready for pickup
const getAvailableOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: "ready", deliveryman: null })
      .populate("restaurant", "name address")
      .populate("customer", "name")
      .sort({ createdAt: 1 });
    return success(res, { orders });
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/orders/:id/accept  (deliveryman)
const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, status: "ready", deliveryman: null });
    if (!order) return error(res, "Order not available.", 400);

    order.deliveryman = req.user._id;
    order.status = "picked_up";
    order.statusHistory.push({ status: "picked_up", note: "Picked up by deliveryman" });
    await order.save();

    const io = req.app.get("io");
    if (io) io.to(`order_${order._id}`).emit("order_update", { status: "picked_up", deliveryman: req.user._id });

    return success(res, { order }, "Order accepted!");
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/orders/:id/deliver  (deliveryman)
const markDelivered = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, deliveryman: req.user._id });
    if (!order) return error(res, "Order not found.", 404);
    if (order.status !== "on_the_way" && order.status !== "picked_up") {
      return error(res, "Order is not in transit.", 400);
    }

    order.status = "delivered";
    order.deliveredAt = new Date();
    order.paymentStatus = "paid";
    order.statusHistory.push({ status: "delivered", note: "Delivered successfully" });
    await order.save();

    // Update deliveryman stats
    await require("../models/User").findByIdAndUpdate(req.user._id, {
      $inc: { "deliveryInfo.totalDeliveries": 1 },
    });

    // Update restaurant order count
    await Restaurant.findByIdAndUpdate(order.restaurant, { $inc: { totalOrders: 1 } });

    const io = req.app.get("io");
    if (io) io.to(`order_${order._id}`).emit("order_update", { status: "delivered" });

    return success(res, { order }, "Order marked as delivered!");
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/orders/deliveryman/mine  (deliveryman)
const getDeliverymanOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { deliveryman: req.user._id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate("customer", "name phone addresses")
      .populate("restaurant", "name address")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    return success(res, { orders });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/orders/:id/location  (deliveryman) — update live GPS
const updateDeliveryLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, deliveryman: req.user._id },
      { deliveryLocation: { lat, lng, updatedAt: new Date() }, status: "on_the_way" },
      { new: true }
    );
    if (!order) return error(res, "Order not found.", 404);

    // Also update deliveryman's own location
    await require("../models/User").findByIdAndUpdate(req.user._id, {
      "deliveryInfo.currentLocation": { lat, lng, updatedAt: new Date() },
    });

    const io = req.app.get("io");
    if (io) io.to(`order_${order._id}`).emit("location_update", { lat, lng });

    return success(res, { lat, lng }, "Location updated.");
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/orders/:id/customer-location  (customer) — update customer live GPS for deliveryman
const updateCustomerLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customer: req.user._id },
      { customerLocation: { lat, lng, updatedAt: new Date() } },
      { new: true }
    );
    if (!order) return error(res, "Order not found.", 404);

    const io = req.app.get("io");
    if (io) {
      io.to(`order_${order._id}`).emit("customer_location_update", {
        lat,
        lng,
        updatedAt: new Date(),
      });
    }

    return success(res, { customerLocation: order.customerLocation }, "Customer location updated.");
  } catch (err) {
    return error(res, err.message);
  }
};

// ── ADMIN ─────────────────────────────────────────────────

// GET /api/orders  (admin)
const getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    const orders = await Order.find(query)
      .populate("customer", "name phone")
      .populate("restaurant", "name")
      .populate("deliveryman", "name phone")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    const total = await Order.countDocuments(query);
    return success(res, { orders, total });
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  placeOrder, getMyOrders, getOrder, cancelOrder,
  getRestaurantOrders, updateOrderStatusByOwner,
  getAvailableOrders, acceptOrder, markDelivered,
  getDeliverymanOrders, updateDeliveryLocation, updateCustomerLocation,
  getAllOrders,
};
