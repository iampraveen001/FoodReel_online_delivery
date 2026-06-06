require("dotenv").config();
const mongoose = require("mongoose");
const FoodItem = require("./src/models/FoodItem");

mongoose.connect(process.env.MONGODB_URI);

FoodItem.find({ videoUrl: { $ne: null } }).then((items) => {
  console.log(items.map((i) => ({ id: i._id, videoUrl: i.videoUrl })));
  process.exit();
});