const express = require("express");
const router = express.Router();
const {
  createFoodItem, getReelsFeed, getByRestaurant,
  getFoodItem, updateFoodItem, deleteFoodItem, toggleAvailability, toggleLike,
} = require("../controllers/foodController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");

const mediaFields = upload.fields([
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

// Public
router.get("/reels", getReelsFeed);
router.get("/restaurant/:restaurantId", getByRestaurant);
router.get("/:id", getFoodItem);

// Protected
router.use(protect);
router.post("/", authorize("owner", "admin"), mediaFields, createFoodItem);
router.put("/:id", authorize("owner", "admin"), mediaFields, updateFoodItem);
router.delete("/:id", authorize("owner", "admin"), deleteFoodItem);
router.patch("/:id/toggle", authorize("owner", "admin"), toggleAvailability);
router.post("/:id/like", authorize("customer"), toggleLike);

module.exports = router;
