const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const { sendPaginated, sendError } = require('../utils/apiResponse');

// GET /api/repos/:owner/:name/audit
exports.getAuditLog = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const { action, username, startDate, endDate, sort = 'desc' } = req.query;

    const filter = { repository: req.repo._id };

    if (action && action !== 'all') {
      filter.action = action;
    }

    if (username) {
      const userDoc = await User.findOne({ username: username.trim() });
      if (!userDoc) {
        return sendPaginated(res, [], page, limit, 0);
      }
      filter.user = userDoc._id;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sortOrder = sort === 'asc' ? 1 : -1;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('user', 'username avatar email')
        .sort({ createdAt: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ]);

    return sendPaginated(res, logs, page, limit, total);
  } catch (err) {
    next(err);
  }
};
