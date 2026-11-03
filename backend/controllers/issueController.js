const Issue = require('../models/Issue');
const IssueComment = require('../models/IssueComment');
const Label = require('../models/Label');
const { logActivity, createNotification } = require('../services/activityService');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');

const getNextIssueNumber = async (repoId) => {
  const last = await Issue.findOne({ repository: repoId }).sort({ number: -1 }).select('number');
  return last ? last.number + 1 : 1;
};

// POST /api/repos/:owner/:name/issues
exports.createIssue = async (req, res, next) => {
  try {
    const { title, body, assignees = [], labels = [] } = req.body;
    if (!title) return sendError(res, 'Issue title is required', 400);

    const number = await getNextIssueNumber(req.repo._id);
    const issue = await Issue.create({
      repository: req.repo._id,
      number,
      title,
      body,
      author: req.user._id,
      assignees,
      labels,
    });

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'issue_created',
      metadata: { issueNumber: number, title },
      entityId: issue._id,
      entityModel: 'Issue',
    });

    // Notify assignees
    for (const assigneeId of assignees) {
      await createNotification({
        recipientId: assigneeId,
        actorId: req.user._id,
        type: 'issue_assigned',
        message: `${req.user.username} assigned you to issue #${number}`,
        relatedEntity: issue._id,
        entityModel: 'Issue',
      });
    }

    return sendSuccess(res, { issue }, 'Issue created', 201);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/issues
exports.listIssues = async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const filter = { repository: req.repo._id };
    if (status !== 'all') filter.status = status;

    const issues = await Issue.find(filter)
      .populate('author', 'username avatar')
      .populate('assignees', 'username avatar')
      .populate('labels')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Issue.countDocuments(filter);
    return sendPaginated(res, issues, page, limit, total);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/issues/:issueNumber
exports.getIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findOne({ repository: req.repo._id, number: req.params.issueNumber })
      .populate('author', 'username avatar')
      .populate('assignees', 'username avatar')
      .populate('labels')
      .populate('closedBy', 'username');

    if (!issue) return sendError(res, 'Issue not found', 404);

    const comments = await IssueComment.find({ issue: issue._id })
      .populate('author', 'username avatar')
      .sort({ createdAt: 1 });

    return sendSuccess(res, { issue, comments });
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/issues/:issueNumber/comments
exports.addComment = async (req, res, next) => {
  try {
    const issue = await Issue.findOne({ repository: req.repo._id, number: req.params.issueNumber });
    if (!issue) return sendError(res, 'Issue not found', 404);

    const comment = await IssueComment.create({ issue: issue._id, author: req.user._id, body: req.body.body });
    await comment.populate('author', 'username avatar');

    // Notify issue author
    if (!issue.author.equals(req.user._id)) {
      await createNotification({
        recipientId: issue.author,
        actorId: req.user._id,
        type: 'issue_commented',
        message: `${req.user.username} commented on issue #${issue.number}`,
        relatedEntity: issue._id,
        entityModel: 'Issue',
      });
    }

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'issue_commented',
      metadata: { issueNumber: issue.number },
    });

    return sendSuccess(res, { comment }, 'Comment added', 201);
  } catch (err) {
    next(err);
  }
};

// PUT /api/repos/:owner/:name/issues/:issueNumber/close
exports.closeIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findOneAndUpdate(
      { repository: req.repo._id, number: req.params.issueNumber, status: 'open' },
      { status: 'closed', closedAt: new Date(), closedBy: req.user._id },
      { new: true }
    );
    if (!issue) return sendError(res, 'Issue not found or already closed', 404);

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'issue_closed',
      metadata: { issueNumber: issue.number },
      entityId: issue._id,
      entityModel: 'Issue',
    });
    return sendSuccess(res, { issue }, 'Issue closed');
  } catch (err) {
    next(err);
  }
};

// PUT /api/repos/:owner/:name/issues/:issueNumber/reopen
exports.reopenIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findOneAndUpdate(
      { repository: req.repo._id, number: req.params.issueNumber, status: 'closed' },
      { status: 'open', closedAt: null, closedBy: null },
      { new: true }
    );
    if (!issue) return sendError(res, 'Issue not found or already open', 404);

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'issue_reopened',
      metadata: { issueNumber: issue.number },
      entityId: issue._id,
      entityModel: 'Issue',
    });
    return sendSuccess(res, { issue }, 'Issue reopened');
  } catch (err) {
    next(err);
  }
};

// PUT /api/repos/:owner/:name/issues/:issueNumber
exports.updateIssue = async (req, res, next) => {
  try {
    const { title, body, assignees, labels } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (body !== undefined) updates.body = body;
    if (assignees !== undefined) updates.assignees = assignees;
    if (labels !== undefined) updates.labels = labels;

    const issue = await Issue.findOneAndUpdate(
      { repository: req.repo._id, number: req.params.issueNumber },
      updates,
      { new: true, runValidators: true }
    )
      .populate('author', 'username avatar')
      .populate('assignees', 'username avatar')
      .populate('labels');

    if (!issue) return sendError(res, 'Issue not found', 404);

    // Notify newly added assignees
    if (assignees) {
      for (const assigneeId of assignees) {
        await createNotification({
          recipientId: assigneeId,
          actorId: req.user._id,
          type: 'issue_assigned',
          message: `${req.user.username} assigned you to issue #${issue.number}`,
          relatedEntity: issue._id,
          entityModel: 'Issue',
        });
      }
    }

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'issue_updated',
      metadata: { issueNumber: issue.number },
      entityId: issue._id,
      entityModel: 'Issue',
    });
    return sendSuccess(res, { issue }, 'Issue updated');
  } catch (err) {
    next(err);
  }
};
