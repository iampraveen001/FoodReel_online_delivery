const User = require("../models/User");
const { generateTokens, verifyToken } = require("../utils/jwt");
const { success, error } = require("../utils/response");

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Only allow registering as customer, owner, or deliveryman publicly
    const allowedRoles = ["customer", "owner", "deliveryman"];
    const userRole = allowedRoles.includes(role) ? role : "customer";

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return error(res, "Email or phone already registered.", 409);
    }

    const user = await User.create({ name, email, phone, password, role: userRole });
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return success(res, { user, accessToken, refreshToken }, "Registered successfully!", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password +refreshToken");
    if (!user || !(await user.comparePassword(password))) {
      return error(res, "Invalid email or password.", 401);
    }
    if (!user.isActive) {
      return error(res, "Your account has been deactivated.", 403);
    }

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return success(res, { user, accessToken, refreshToken }, "Login successful!");
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return error(res, "Refresh token required.", 400);

    const decoded = verifyToken(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select("+refreshToken");

    if (!user || user.refreshToken !== token) {
      return error(res, "Invalid refresh token.", 401);
    }

    const tokens = generateTokens(user._id, user.role);
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    return success(res, tokens, "Token refreshed!");
  } catch (err) {
    return error(res, "Invalid or expired refresh token.", 401);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    return success(res, {}, "Logged out successfully.");
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  return success(res, { user: req.user });
};

module.exports = { register, login, refreshToken, logout, getMe };
