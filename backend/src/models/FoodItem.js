const mongoose = require("mongoose");

const foodItemSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: String,
    price: { type: Number, required: true, min: 0 },
    category: String, // "Starters", "Main Course", "Desserts", etc.
    tags: [String], // ["spicy", "veg", "bestseller"]
    isVeg: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },

    // Video reel fields
    videoUrl: { type: String, default: null },   // path or CDN URL
    thumbnailUrl: { type: String, default: null },
    videoDuration: { type: Number, default: 0 }, // seconds

    // Engagement
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("FoodItem", foodItemSchema);
