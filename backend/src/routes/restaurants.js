const express = require("express");
const router = express.Router();
const {
  createRestaurant, getRestaurants, getRestaurant,
  getMyRestaurant, updateRestaurant, toggleRestaurantStatus,
  approveRestaurant, getPendingRestaurants,
} = require("../controllers/restaurantController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");

const logoFields = upload.fields([{ name: "logo", maxCount: 1 }, { name: "coverImage", maxCount: 1 }]);

// Public
router.get("/", getRestaurants);

// Owner - must be before /:id route to avoid conflicts
router.use(protect);
router.get("/owner/mine", authorize("owner"), getMyRestaurant);
router.post("/", authorize("owner", "admin"), logoFields, createRestaurant);
router.put("/:id", authorize("owner", "admin"), logoFields, updateRestaurant);
router.put("/:id/toggle", authorize("owner"), toggleRestaurantStatus);

// Public detail route - after owner routes
router.get("/:id", getRestaurant);

// Admin
router.get("/admin/pending", authorize("admin"), getPendingRestaurants);
router.put("/:id/approve", authorize("admin"), approveRestaurant);

module.exports = router;
