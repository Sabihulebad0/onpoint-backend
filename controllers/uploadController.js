const { saveImage, storageMode } = require("../config/storage");

const uploadCustom = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Choose an image to upload" });
    }
    const url = await saveImage(req.file, "custom", { requireS3: true });
    res.status(201).json({ url, folder: "custom", storage: storageMode() || "s3" });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadCustom };
