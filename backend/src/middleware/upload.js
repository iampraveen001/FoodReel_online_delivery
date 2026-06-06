const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => {
      if (file.mimetype.startsWith("video/")) return "videos";
      else if (file.mimetype.startsWith("image/")) return "images";
      return "misc";
    },
    resource_type: (req, file) => {
      if (file.mimetype.startsWith("video/")) return "video";
      return "auto";
    },
    public_id: (req, file) => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only images (jpg/png/webp) and videos (mp4/mov/webm) are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 }, // 100MB
});

module.exports = upload;
