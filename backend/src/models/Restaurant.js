const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,  // Each owner can have only ONE restaurant
    },
    name: { type: String, required: true, trim: true },
    description: String,
    logo: String,
    coverImage: String,
    cuisine: [String], // ["Indian", "Chinese", ...]
    address: {
      line1: String,
      city: String,
      state: String,
      pincode: String,
      lat: Number,
      lng: Number,
    },
    phone: String,
    email: String,
    isOpen: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false }, // admin must approve
    openingTime: { type: String, default: "09:00" },
    closingTime: { type: String, default: "23:00" },
    deliveryRadius: { type: Number, default: 10 }, // km
    minOrderAmount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 29 },
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Restaurant", restaurantSchema);
