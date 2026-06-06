const FoodItem = require("../models/FoodItem");
const Restaurant = require("../models/Restaurant");
const { success, error } = require("../utils/response");

// Helper: verify owner owns the restaurant
const verifyOwner = async (restaurantId, userId) => {
  const restaurant = await Restaurant.findOne({ _id: restaurantId, owner: userId });
  return restaurant;
};

// POST /api/food  (owner) — with video upload
const createFoodItem = async (req, res) => {
  try {
    const restaurant = await verifyOwner(req.body.restaurant, req.user._id);
    if (!restaurant) return error(res, "Restaurant not found or unauthorized.", 403);

    const data = { ...req.body };
    if (req.files?.video) data.videoUrl = req.files.video[0].path;
    if (req.files?.thumbnail) data.thumbnailUrl = req.files.thumbnail[0].path;

    const item = await FoodItem.create(data);
    return success(res, { item }, "Food item created!", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// GET /api/food/reels  (public) — feed for homepage reels
const getReelsFeed = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const items = await FoodItem.find({ isAvailable: true, videoUrl: { $ne: null } })
      .populate({ path: "restaurant", select: "name logo cuisine isOpen isApproved" })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1, likes: -1 });

    // Filter out items whose restaurant failed the match (not approved)
    const feed = items.filter((i) => i.restaurant);
    return success(res, { feed, page: parseInt(page) });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/food/restaurant/:restaurantId  (public)
const getByRestaurant = async (req, res) => {
  try {
    const items = await FoodItem.find({ restaurant: req.params.restaurantId, isAvailable: true });
    return success(res, { items });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/food/:id  (public)
const getFoodItem = async (req, res) => {
  try {
    const item = await FoodItem.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate("restaurant", "name logo");
    if (!item) return error(res, "Food item not found.", 404);
    return success(res, { item });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/food/:id  (owner)
const updateFoodItem = async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id).populate("restaurant");
    if (!item) return error(res, "Food item not found.", 404);
    if (String(item.restaurant.owner) !== String(req.user._id)) {
      return error(res, "Unauthorized.", 403);
    }
    const updates = { ...req.body };
    if (req.files?.video) updates.videoUrl = req.files.video[0].path;
    if (req.files?.thumbnail) updates.thumbnailUrl = req.files.thumbnail[0].path;

    Object.assign(item, updates);
    await item.save();
    return success(res, { item }, "Food item updated.");
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// DELETE /api/food/:id  (owner)
const deleteFoodItem = async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id).populate("restaurant");
    if (!item) return error(res, "Food item not found.", 404);
    if (String(item.restaurant.owner) !== String(req.user._id)) {
      return error(res, "Unauthorized.", 403);
    }
    await item.deleteOne();
    return success(res, {}, "Food item deleted.");
  } catch (err) {
    return error(res, err.message);
  }
};

// PATCH /api/food/:id/toggle  (owner) — toggle isAvailable
const toggleAvailability = async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id).populate("restaurant");
    if (!item) return error(res, "Food item not found.", 404);
    if (String(item.restaurant.owner) !== String(req.user._id)) {
      return error(res, "Unauthorized.", 403);
    }
    item.isAvailable = !item.isAvailable;
    await item.save();
    return success(res, { item, isAvailable: item.isAvailable }, "Availability updated.");
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/food/:id/like  (customer)
const toggleLike = async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id);
    if (!item) return error(res, "Food item not found.", 404);

    const liked = item.likedBy.includes(req.user._id);
    if (liked) {
      item.likedBy.pull(req.user._id);
      item.likes = Math.max(0, item.likes - 1);
    } else {
      item.likedBy.push(req.user._id);
      item.likes += 1;
    }
    await item.save();
    return success(res, { liked: !liked, likes: item.likes });
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  createFoodItem, getReelsFeed, getByRestaurant,
  getFoodItem, updateFoodItem, deleteFoodItem, toggleAvailability, toggleLike,
};
