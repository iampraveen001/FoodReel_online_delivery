const { verifyToken } = require("../utils/jwt");
const { error } = require("../utils/response");
const User = require("../models/User");

// Verify JWT and attach user to req
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return error(res, "Access denied. No token provided.", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password -refreshToken");
    if (!user || !user.isActive) {
      return error(res, "User not found or deactivated.", 401);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return error(res, "Token expired. Please login again.", 401);
    }
    return error(res, "Invalid token.", 401);
  }
};

// Role-based access control
// Usage: authorize("admin", "owner")
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return error(
        res,
        `Access denied. Role '${req.user.role}' is not allowed.`,
        403
      );
    }
    next();
  };
};

module.exports = { protect, authorize };
