const express = require("express");
const router = express.Router();
const {
  getProfile, updateProfile, changePassword,
  getAddresses, addAddress, updateAddress, deleteAddress,
  getAllUsers, toggleUserStatus, changeUserRole,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.use(protect);

router.get("/profile", getProfile);
router.put("/profile", upload.single("avatar"), updateProfile);
router.put("/password", changePassword);

router.get("/addresses", getAddresses);
router.post("/addresses", addAddress);
router.put("/addresses/:addressId", updateAddress);
router.delete("/addresses/:addressId", deleteAddress);

// Admin only
router.get("/", authorize("admin"), getAllUsers);
router.put("/:id/status", authorize("admin"), toggleUserStatus);
router.put("/:id/role", authorize("admin"), changeUserRole);

module.exports = router;
