const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || "Server error";

  if (err.name === "ValidationError") {
    return res.status(400).json({ message, errors: err.errors });
  }

  if (err.name === "CastError") {
    return res.status(404).json({ message: "Not found" });
  }

  res.status(status).json({
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

module.exports = errorHandler;
