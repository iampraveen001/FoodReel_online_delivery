const express = require("express");
const router = express.Router();
const {
  toggleAvailability, updateLocation,
  updateVehicleInfo, getStats, getAllDeliverymen,
} = require("../controllers/deliveryController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.put("/availability", authorize("deliveryman"), toggleAvailability);
router.put("/location", authorize("deliveryman"), updateLocation);
router.put("/vehicle", authorize("deliveryman"), updateVehicleInfo);
router.get("/stats", authorize("deliveryman"), getStats);

// Admin
router.get("/all", authorize("admin"), getAllDeliverymen);

module.exports = router;
