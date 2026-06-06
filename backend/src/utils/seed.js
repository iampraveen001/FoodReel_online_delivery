require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const FoodItem = require("../models/FoodItem");

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("🌱 Seeding database...");

  // Clear existing
  await Promise.all([
    User.deleteMany({}),
    Restaurant.deleteMany({}),
    FoodItem.deleteMany({}),
  ]);

  const hash = (p) => bcrypt.hash(p, 12);

  // Create users
  const [admin, owner, customer, delivery] = await User.create([
    {
      name: "Admin User",
      email: "admin@foodreels.com",
      phone: "9000000001",
      password: await hash("admin123"),
      role: "admin",
      isVerified: true,
    },
    {
      name: "Ramu Restaurant Owner",
      email: "owner@foodreels.com",
      phone: "9000000002",
      password: await hash("owner123"),
      role: "owner",
      isVerified: true,
    },
    {
      name: "Rahul Customer",
      email: "customer@foodreels.com",
      phone: "9000000003",
      password: await hash("customer123"),
      role: "customer",
      isVerified: true,
      addresses: [{
        label: "Home",
        line1: "Civil Lines, Prayagraj",
        city: "Prayagraj",
        state: "Uttar Pradesh",
        pincode: "211001",
        lat: 25.4484,
        lng: 81.8322,
      }],
    },
    {
      name: "Rajan Deliveryman",
      email: "delivery@foodreels.com",
      phone: "9000000004",
      password: await hash("delivery123"),
      role: "deliveryman",
      isVerified: true,
      deliveryInfo: {
        vehicleType: "bike",
        vehicleNumber: "UP70AB1234",
        isAvailable: true,
        totalDeliveries: 320,
        rating: 4.8,
      },
    },
  ]);

  // Create restaurant
  const restaurant = await Restaurant.create({
    owner: owner._id,
    name: "Punjabi Tadka",
    description: "Authentic Punjabi food with a modern twist",
    cuisine: ["Indian", "Punjabi"],
    address: {
      line1: "MG Road, Prayagraj",
      city: "Prayagraj",
      state: "Uttar Pradesh",
      pincode: "211001",
      lat: 25.4550,
      lng: 81.8400,
    },
    phone: "9000000099",
    isOpen: true,
    isApproved: true,
    deliveryFee: 29,
    minOrderAmount: 99,
    avgRating: 4.8,
  });

  // Create food items
  await FoodItem.create([
    {
      restaurant: restaurant._id,
      name: "Dal Makhani Thali",
      description: "Rich creamy dal, naan, chawal aur salad ke saath",
      price: 189,
      category: "Main Course",
      tags: ["bestseller", "veg"],
      isVeg: true,
      likes: 876,
      views: 5400,
    },
    {
      restaurant: restaurant._id,
      name: "Butter Chicken",
      description: "Creamy tomato curry with tender chicken pieces",
      price: 249,
      category: "Main Course",
      tags: ["non-veg", "popular"],
      isVeg: false,
      likes: 1200,
      views: 8900,
    },
    {
      restaurant: restaurant._id,
      name: "Paneer Tikka",
      description: "Grilled cottage cheese with spicy marinade",
      price: 199,
      category: "Starters",
      tags: ["veg", "spicy"],
      isVeg: true,
      likes: 543,
      views: 3200,
    },
  ]);

  console.log("✅ Seed complete!\n");
  console.log("📋 Login credentials:");
  console.log("  Admin:       admin@foodreels.com    / admin123");
  console.log("  Owner:       owner@foodreels.com    / owner123");
  console.log("  Customer:    customer@foodreels.com / customer123");
  console.log("  Deliveryman: delivery@foodreels.com / delivery123");

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
