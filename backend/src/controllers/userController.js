const User = require("../models/User");
const { success, error } = require("../utils/response");

// GET /api/users/profile
const getProfile = async (req, res) => {
  return success(res, { user: req.user });
};

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const allowedFields = ["name", "phone", "avatar"];
    const updates = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.file) updates.avatar = req.file.path;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    return success(res, { user }, "Profile updated.");
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// PUT /api/users/password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!(await user.comparePassword(currentPassword))) {
      return error(res, "Current password is incorrect.", 400);
    }

    user.password = newPassword;
    await user.save();
    return success(res, {}, "Password changed successfully.");
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// GET /api/users/addresses
const getAddresses = async (req, res) => {
  return success(res, { addresses: req.user.addresses });
};

// POST /api/users/addresses
const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses.push(req.body);
    await user.save();
    return success(res, { addresses: user.addresses }, "Address added.", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// PUT /api/users/addresses/:addressId
const updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return error(res, "Address not found.", 404);
    Object.assign(addr, req.body);
    await user.save();
    return success(res, { addresses: user.addresses }, "Address updated.");
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// DELETE /api/users/addresses/:addressId
const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses.pull(req.params.addressId);
    await user.save();
    return success(res, {}, "Address deleted.");
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// ── ADMIN ONLY ──────────────────────────────────────────

// GET /api/users  (admin)
const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const query = role ? { role } : {};
    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    const total = await User.countDocuments(query);
    return success(res, { users, total, page: parseInt(page) });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/users/:id/status  (admin)
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return error(res, "User not found.", 404);
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    return success(res, { user }, `User ${user.isActive ? "activated" : "deactivated"}.`);
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/users/:id/role  (admin)
const changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ["customer", "owner", "deliveryman", "admin"];
    if (!allowed.includes(role)) return error(res, "Invalid role.", 400);
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return error(res, "User not found.", 404);
    return success(res, { user }, "Role updated.");
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  getProfile, updateProfile, changePassword,
  getAddresses, addAddress, updateAddress, deleteAddress,
  getAllUsers, toggleUserStatus, changeUserRole,
};
