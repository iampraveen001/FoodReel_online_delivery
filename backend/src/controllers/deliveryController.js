const User = require("../models/User");
const { success, error } = require("../utils/response");

// PUT /api/deliveryman/availability  — toggle availability
const toggleAvailability = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.deliveryInfo.isAvailable = !user.deliveryInfo.isAvailable;
    await user.save({ validateBeforeSave: false });
    return success(res, { isAvailable: user.deliveryInfo.isAvailable });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/deliveryman/location  — update GPS
const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return error(res, "lat and lng are required.", 400);

    await User.findByIdAndUpdate(req.user._id, {
      "deliveryInfo.currentLocation": { lat, lng, updatedAt: new Date() },
    });
    return success(res, { lat, lng }, "Location updated.");
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/deliveryman/vehicle  — set vehicle info
const updateVehicleInfo = async (req, res) => {
  try {
    const { vehicleType, vehicleNumber } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      "deliveryInfo.vehicleType": vehicleType,
      "deliveryInfo.vehicleNumber": vehicleNumber,
    });
    return success(res, {}, "Vehicle info updated.");
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// GET /api/deliveryman/stats  — personal stats
const getStats = async (req, res) => {
  try {
    const Order = require("../models/Order");
    const user = await User.findById(req.user._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDeliveries = await Order.countDocuments({
      deliveryman: req.user._id,
      status: "delivered",
      deliveredAt: { $gte: today },
    });

    const totalEarnings = await Order.aggregate([
      { $match: { deliveryman: req.user._id, status: "delivered" } },
      { $group: { _id: null, total: { $sum: "$deliveryFee" } } },
    ]);

    return success(res, {
      totalDeliveries: user.deliveryInfo.totalDeliveries,
      rating: user.deliveryInfo.rating,
      todayDeliveries,
      totalEarnings: totalEarnings[0]?.total || 0,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/deliveryman/all  (admin)
const getAllDeliverymen = async (req, res) => {
  try {
    const { available } = req.query;
    const query = { role: "deliveryman" };
    if (available === "true") query["deliveryInfo.isAvailable"] = true;

    const deliverymen = await User.find(query).select("-password -refreshToken");
    return success(res, { deliverymen });
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { toggleAvailability, updateLocation, updateVehicleInfo, getStats, getAllDeliverymen };
