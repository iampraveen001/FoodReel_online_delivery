const express = require("express");
const router = express.Router();
const {
  placeOrder, getMyOrders, getOrder, cancelOrder,
  getRestaurantOrders, updateOrderStatusByOwner,
  getAvailableOrders, acceptOrder, markDelivered,
  getDeliverymanOrders, updateDeliveryLocation, updateCustomerLocation,
  getAllOrders,
} = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// Customer
router.post("/", authorize("customer"), placeOrder);
router.get("/my", authorize("customer"), getMyOrders);
router.post("/:id/cancel", authorize("customer"), cancelOrder);

// Owner
router.get("/restaurant/:restaurantId", authorize("owner", "admin"), getRestaurantOrders);
router.put("/:id/status", authorize("owner", "admin"), updateOrderStatusByOwner);

// Deliveryman
router.get("/available", authorize("deliveryman"), getAvailableOrders);
router.post("/:id/accept", authorize("deliveryman"), acceptOrder);
router.put("/:id/deliver", authorize("deliveryman"), markDelivered);
router.get("/deliveryman/mine", authorize("deliveryman"), getDeliverymanOrders);
router.put("/:id/location", authorize("deliveryman"), updateDeliveryLocation);

// Customer live location sharing
router.put("/:id/customer-location", authorize("customer"), updateCustomerLocation);

// Admin
router.get("/", authorize("admin"), getAllOrders);

// Shared (any role with access)
router.get("/:id", getOrder);

module.exports = router;
