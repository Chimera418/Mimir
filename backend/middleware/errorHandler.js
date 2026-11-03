const { sendError } = require('../utils/apiResponse');

/**
 * Global error handler — must be registered last in Express app.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 'Validation failed', 422, errors);
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, `${field} already exists`, 409);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return sendError(res, `Invalid ${err.path}: ${err.value}`, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Transaction abort
  if (err.message && err.message.includes('Transaction')) {
    return sendError(res, 'Transaction failed — operation rolled back', 500);
  }

  const statusCode = err.statusCode || 500;
  return sendError(res, err.message || 'Internal server error', statusCode);
};

module.exports = errorHandler;
