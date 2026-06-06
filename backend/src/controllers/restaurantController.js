const Restaurant = require("../models/Restaurant");
const { success, error } = require("../utils/response");

// POST /api/restaurants  (owner)
const createRestaurant = async (req, res) => {
  try {
    const existing = await Restaurant.findOne({ owner: req.user._id });
    if (existing) return error(res, "You already have a restaurant.", 409);

    const data = { ...req.body, owner: req.user._id, isApproved: true };
    if (req.files?.logo) data.logo = req.files.logo[0].path;
    if (req.files?.coverImage) data.coverImage = req.files.coverImage[0].path;

    const restaurant = await Restaurant.create(data);
    return success(res, { restaurant }, "Restaurant created and auto-approved for testing!", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// GET /api/restaurants  (public)
const getRestaurants = async (req, res) => {
  try {
    const { cuisine, city, search, page = 1, limit = 20 } = req.query;
    const query = { isApproved: true };
    if (cuisine) query.cuisine = { $in: [cuisine] };
    if (city) query["address.city"] = new RegExp(city, "i");
    if (search) query.name = new RegExp(search, "i");

    const restaurants = await Restaurant.find(query)
      .populate("owner", "name email phone")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ avgRating: -1 });

    const total = await Restaurant.countDocuments(query);
    return success(res, { restaurants, total });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/restaurants/:id  (public)
const getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate("owner", "name email phone");
    if (!restaurant) return error(res, "Restaurant not found.", 404);
    return success(res, { restaurant });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/restaurants/owner/mine  (owner)
const getMyRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) return success(res, { restaurant: null }, "No restaurant created yet", 200);
    return success(res, { restaurant });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/restaurants/:id  (owner)
const updateRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ _id: req.params.id, owner: req.user._id });
    if (!restaurant) return error(res, "Restaurant not found or unauthorized.", 404);

    const updates = { ...req.body };
    if (req.files?.logo) updates.logo = req.files.logo[0].path;
    if (req.files?.coverImage) updates.coverImage = req.files.coverImage[0].path;

    Object.assign(restaurant, updates);
    await restaurant.save();
    return success(res, { restaurant }, "Restaurant updated.");
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// PUT /api/restaurants/:id/toggle  (owner) — open/close
const toggleRestaurantStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ _id: req.params.id, owner: req.user._id });
    if (!restaurant) return error(res, "Restaurant not found.", 404);
    restaurant.isOpen = !restaurant.isOpen;
    await restaurant.save();
    return success(res, { isOpen: restaurant.isOpen }, `Restaurant is now ${restaurant.isOpen ? "Open" : "Closed"}.`);
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/restaurants/:id/approve  (admin)
const approveRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    if (!restaurant) return error(res, "Restaurant not found.", 404);
    return success(res, { restaurant }, "Restaurant approved.");
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/restaurants/pending  (admin)
const getPendingRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ isApproved: false }).populate("owner", "name email");
    return success(res, { restaurants });
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  createRestaurant, getRestaurants, getRestaurant,
  getMyRestaurant, updateRestaurant, toggleRestaurantStatus,
  approveRestaurant, getPendingRestaurants,
};
