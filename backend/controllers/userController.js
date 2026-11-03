const User = require('../models/User');
const Repository = require('../models/Repository');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');

// GET /api/users/:username
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return sendError(res, 'User not found', 404);

    const repos = await Repository.find({
      owner: user._id,
      visibility: req.user && req.user._id.equals(user._id) ? { $in: ['public', 'private'] } : 'public',
    })
      .sort({ updatedAt: -1 })
      .limit(10);

    return sendSuccess(res, { user, repos });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/me
exports.updateProfile = async (req, res, next) => {
  try {
    const { bio, avatar } = req.body;
    const allowed = {};
    if (bio !== undefined) allowed.bio = bio;
    if (avatar !== undefined) allowed.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, allowed, { new: true, runValidators: true });
    return sendSuccess(res, { user }, 'Profile updated');
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/me/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return sendError(res, 'Both current and new password are required', 400);
    if (newPassword.length < 6) return sendError(res, 'New password must be at least 6 characters', 400);

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.comparePassword(currentPassword))) {
      return sendError(res, 'Current password is incorrect', 401);
    }

    user.passwordHash = newPassword;
    await user.save();
    return sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/users/me/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unread === 'true';

    const filter = { recipient: req.user._id };
    if (unreadOnly) filter.read = false;

    const notifications = await Notification.find(filter)
      .populate('actor', 'username avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });

    return sendPaginated(res, { notifications, unreadCount }, page, limit, total);
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/me/notifications/read
exports.markNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    return sendSuccess(res, {}, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
};

// GET /api/users/me/activity
exports.getActivity = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const activity = await ActivityLog.find({ user: req.user._id })
      .populate('repository', 'name owner')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await ActivityLog.countDocuments({ user: req.user._id });
    return sendPaginated(res, activity, page, limit, total);
  } catch (err) {
    next(err);
  }
};
