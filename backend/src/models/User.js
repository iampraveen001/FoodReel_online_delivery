const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema({
  label: { type: String, default: "Home" }, // Home / Work / Other
  line1: String,
  city: String,
  state: String,
  pincode: String,
  lat: Number,
  lng: Number,
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // never return password in queries
    },
    role: {
      type: String,
      enum: ["customer", "owner", "deliveryman", "admin"],
      default: "customer",
    },
    avatar: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },

    // Customer-specific
    addresses: [addressSchema],
    savedRestaurants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }],

    // Deliveryman-specific
    deliveryInfo: {
      isAvailable: { type: Boolean, default: false },
      vehicleType: { type: String, enum: ["bike", "bicycle", "scooter"], default: "bike" },
      vehicleNumber: String,
      currentLocation: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        updatedAt: Date,
      },
      totalDeliveries: { type: Number, default: 0 },
      rating: { type: Number, default: 5.0, min: 1, max: 5 },
    },

    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
