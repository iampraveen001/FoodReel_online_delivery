// Utility functions for location calculations

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Find the nearest available deliveryman to a given location
 * @param {number} targetLat - Target latitude
 * @param {number} targetLng - Target longitude
 * @param {number} maxDistance - Maximum distance in kilometers (default: 10km)
 * @returns {Object|null} Nearest deliveryman or null if none found
 */
const findNearestDeliveryman = async (targetLat, targetLng, maxDistance = 10) => {
  const User = require("../models/User");

  try {
    // Find all available deliverymen with location data
    const deliverymen = await User.find({
      role: "deliveryman",
      "deliveryInfo.isAvailable": true,
      "deliveryInfo.currentLocation.lat": { $exists: true, $ne: null },
      "deliveryInfo.currentLocation.lng": { $exists: true, $ne: null }
    }).select("name phone deliveryInfo");

    if (deliverymen.length === 0) {
      return null;
    }

    let nearestDeliveryman = null;
    let shortestDistance = Infinity;

    // Calculate distance for each deliveryman
    for (const deliveryman of deliverymen) {
      const distance = calculateDistance(
        targetLat,
        targetLng,
        deliveryman.deliveryInfo.currentLocation.lat,
        deliveryman.deliveryInfo.currentLocation.lng
      );

      // Check if within max distance and closer than current nearest
      if (distance <= maxDistance && distance < shortestDistance) {
        shortestDistance = distance;
        nearestDeliveryman = {
          ...deliveryman.toObject(),
          distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
        };
      }
    }

    return nearestDeliveryman;
  } catch (error) {
    console.error("Error finding nearest deliveryman:", error);
    return null;
  }
};

module.exports = {
  calculateDistance,
  findNearestDeliveryman
};