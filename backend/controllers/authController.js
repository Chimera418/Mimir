const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { logActivity } = require('../services/activityService');

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { username, email, password, bio } = req.body;

    if (!username || !email || !password) {
      return sendError(res, 'Username, email, and password are required', 400);
    }

    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400);
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      return sendError(res, `An account with this ${field} already exists`, 409);
    }

    const user = await User.create({
      username,
      email,
      passwordHash: password, // pre-save hook hashes it
      bio: bio || '',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`,
    });

    await logActivity({ userId: user._id, action: 'user_registered', metadata: { username } });

    const token = signToken(user._id);
    return sendSuccess(res, { token, user }, 'Account created successfully', 201);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 'Email and password are required', 400);

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return sendError(res, 'Invalid credentials', 401);
    }

    if (user.accountStatus !== 'active') {
      return sendError(res, 'Your account is not active', 403);
    }

    user.lastLogin = new Date();
    await user.save();

    await logActivity({ userId: user._id, action: 'user_login', metadata: { email } });

    const token = signToken(user._id);
    const safeUser = user.toJSON();
    return sendSuccess(res, { token, user: safeUser }, 'Logged in successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
};
