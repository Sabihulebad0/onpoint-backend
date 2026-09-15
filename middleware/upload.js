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

const customUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const name = String(file.originalname || "").toLowerCase();
    const okMime = !mime || mime === "application/octet-stream" || /^image\/(jpeg|jpg|png|webp|gif)$/i.test(mime);
    const okName = /\.(jpe?g|png|webp|gif)$/i.test(name) || !name.includes(".");
    if (okMime && okName) return cb(null, true);
    cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed"));
  },
}).single("file");

const customImage = (req, res, next) => {
  customUpload(req, res, (error) => {
    if (error) {
      error.statusCode = 400;
      return next(error);
    }
    if (req.file) {
      const name = String(req.file.originalname || "design.jpg");
      if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) req.file.originalname = `${name}.jpg`;
      if (!/^image\//i.test(req.file.mimetype || "")) req.file.mimetype = "image/jpeg";
    }
    next();
  });
};

const anyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const okMime = !mime || mime === "application/octet-stream" || /^image\//i.test(mime);
    if (okMime) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
}).any();

const anyImage = (req, res, next) => {
  anyUpload(req, res, (error) => {
    if (error) {
      error.statusCode = 400;
      return next(error);
    }
    const files = Array.isArray(req.files) ? req.files : [];
    req.file = req.file || files[0];
    if (req.file) {
      const name = String(req.file.originalname || "avatar.jpg");
      if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) req.file.originalname = `${name}.jpg`;
      if (!/^image\//i.test(req.file.mimetype || "")) req.file.mimetype = "image/jpeg";
    }
    next();
  });
};

module.exports = { productImages, categoryIcon, couponImage, customImage, anyImage };
