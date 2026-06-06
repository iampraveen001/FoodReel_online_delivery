const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    deliveryman: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    foodRating: { type: Number, min: 1, max: 5, required: true },
    deliveryRating: { type: Number, min: 1, max: 5 },
    comment: String,
  },
  { timestamps: true }
);

// One review per order
reviewSchema.index({ order: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
