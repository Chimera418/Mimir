const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/apiResponse');

/**
 * protect — Verifies JWT and attaches req.user.
 * Must be used on all protected routes.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendError(res, 'Not authorized — no token provided', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return sendError(res, 'User belonging to this token no longer exists', 401);
    }

    if (user.accountStatus !== 'active') {
      return sendError(res, 'Your account has been suspended or deleted', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    return sendError(res, 'Not authorized — invalid token', 401);
  }
};

/**
 * optionalAuth — Attaches req.user if token present, doesn't fail if absent.
 * Used for public routes that show extra data to logged-in users.
 */
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash');
  } catch {
    // ignore invalid token in optional auth
  }
  next();
};

/**
 * signToken — Creates a JWT for a user.
 */
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

module.exports = { protect, optionalAuth, signToken };
