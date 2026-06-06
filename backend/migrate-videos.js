require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");
const FoodItem = require("./src/models/FoodItem");
const mongoose = require("mongoose");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const uploadToCloudinary = async (filePath, folder, resourceType = "auto") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
    });
    return result.secure_url;
  } catch (error) {
    console.error(`Error uploading ${filePath}:`, error);
    return null;
  }
};

const migrateFiles = async () => {
  try {
    const dirs = [
      { dir: "videos", folder: "videos", resourceType: "video" },
      { dir: "images", folder: "images", resourceType: "image" },
    ];

    for (const { dir, folder, resourceType } of dirs) {
      const filesDir = path.join(__dirname, "uploads", dir);

      if (!fs.existsSync(filesDir)) {
        console.log(`No ${dir} directory found.`);
        continue;
      }

      const files = fs.readdirSync(filesDir);

      for (const file of files) {
        const filePath = path.join(filesDir, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile()) {
          // Find the FoodItem with this url (handle both forward and back slashes)
          const localPathForward = `uploads/${dir}/${file}`;
          const localPathBack = `uploads\\${dir}\\${file}`;
          const item = await FoodItem.findOne({
            $or: [
              { videoUrl: localPathForward },
              { videoUrl: localPathBack },
              { thumbnailUrl: localPathForward },
              { thumbnailUrl: localPathBack },
            ],
          });

          if (item) {
            console.log(`Uploading ${file}...`);
            const cloudUrl = await uploadToCloudinary(filePath, folder, resourceType);

            if (cloudUrl) {
              if (item.videoUrl === localPath) {
                item.videoUrl = cloudUrl;
              } else if (item.thumbnailUrl === localPath) {
                item.thumbnailUrl = cloudUrl;
              }
              await item.save();
              console.log(`Updated ${file} to ${cloudUrl}`);

              // Optionally delete local file
              fs.unlinkSync(filePath);
            }
          } else {
            console.log(`No FoodItem found for ${file}`);
          }
        }
      }
    }

    console.log("Migration completed.");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    mongoose.disconnect();
  }
};

migrateFiles();