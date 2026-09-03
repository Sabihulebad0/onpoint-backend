const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|jpg)$/i.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed"));
  },
});

const productImages = (req, res, next) => {
  upload.any()(req, res, (error) => {
    if (error) {
      error.statusCode = 400;
      return next(error);
    }

    const files = Array.isArray(req.files) ? req.files : [];
    req.files = {
      thumbnail: files.filter((file) => file.fieldname === "thumbnail"),
      images: files.filter((file) => file.fieldname === "images"),
    };
    next();
  });
};

const singleImage = (field) => (req, res, next) => {
  upload.single(field)(req, res, (error) => {
    if (error) {
      error.statusCode = 400;
      return next(error);
    }
    next();
  });
};

const categoryIcon = singleImage("icon");
const couponImage = singleImage("image");

module.exports = { productImages, categoryIcon, couponImage };
