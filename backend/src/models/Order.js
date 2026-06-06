const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  foodItem: { type: mongoose.Schema.Types.ObjectId, ref: "FoodItem", required: true },
  name: String,   // snapshot at time of order
  price: Number,
  qty: { type: Number, default: 1 },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    deliveryman: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    items: [orderItemSchema],

    status: {
      type: String,
      enum: [
        "pending",       // placed, waiting for restaurant
        "confirmed",     // restaurant confirmed
        "preparing",     // being cooked
        "ready",         // ready for pickup
        "picked_up",     // deliveryman picked up
        "on_the_way",    // in transit
        "delivered",     // completed
        "cancelled",     // cancelled
      ],
      default: "pending",
    },

    deliveryAddress: {
      line1: String,
      city: String,
      state: String,
      pincode: String,
      lat: Number,
      lng: Number,
    },

    customerLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: Date,
    },

    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 29 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ["cod", "online", "upi"],
      default: "cod",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    // Live tracking
    deliveryLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: Date,
    },

    estimatedDeliveryTime: Date, // set when order confirmed
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: String,

    // Status timeline
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

// Auto-generate order number
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderNumber = `FR${Date.now().toString().slice(-6)}${count + 1}`;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
