const PullRequest = require('../models/PullRequest');
const PRComment = require('../models/PRComment');
const Branch = require('../models/Branch');
const { mergePullRequest, checkPullRequestConflicts, resolveConflictsAndPush } = require('../services/mergeService');
const { logActivity, createNotification } = require('../services/activityService');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');

const getNextPRNumber = async (repoId) => {
  const last = await PullRequest.findOne({ repository: repoId }).sort({ number: -1 }).select('number');
  return last ? last.number + 1 : 1;
};

// POST /api/repos/:owner/:name/pulls
exports.createPR = async (req, res, next) => {
  try {
    const { title, description, sourceBranchName, targetBranchName } = req.body;
    if (!title || !sourceBranchName || !targetBranchName) {
      return sendError(res, 'title, sourceBranchName, and targetBranchName are required', 400);
    }
    if (sourceBranchName === targetBranchName) return sendError(res, 'Source and target branches cannot be the same', 400);

    const [source, target] = await Promise.all([
      Branch.findOne({ repository: req.repo._id, name: sourceBranchName }),
      Branch.findOne({ repository: req.repo._id, name: targetBranchName }),
    ]);
    if (!source) return sendError(res, `Source branch '${sourceBranchName}' not found`, 404);
    if (!target) return sendError(res, `Target branch '${targetBranchName}' not found`, 404);

    const number = await getNextPRNumber(req.repo._id);
    const pr = await PullRequest.create({
      repository: req.repo._id,
      number,
      title,
      description,
      sourceBranch: source._id,
      targetBranch: target._id,
      author: req.user._id,
    });

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'pr_opened',
      metadata: { prNumber: number, title },
      entityId: pr._id,
      entityModel: 'PullRequest',
    });

    return sendSuccess(res, { pr }, 'Pull request opened', 201);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/pulls
exports.listPRs = async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const filter = { repository: req.repo._id };
    if (status !== 'all') filter.status = status;

    const prs = await PullRequest.find(filter)
      .populate('author', 'username avatar')
      .populate('sourceBranch', 'name')
      .populate('targetBranch', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await PullRequest.countDocuments(filter);
    return sendPaginated(res, prs, page, limit, total);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/pulls/:prNumber
exports.getPR = async (req, res, next) => {
  try {
    const pr = await PullRequest.findOne({ repository: req.repo._id, number: req.params.prNumber })
      .populate('author', 'username avatar')
      .populate('sourceBranch', 'name headCommit')
      .populate('targetBranch', 'name headCommit')
      .populate('mergedBy', 'username');

    if (!pr) return sendError(res, 'Pull request not found', 404);

    const comments = await PRComment.find({ pullRequest: pr._id })
      .populate('author', 'username avatar')
      .sort({ createdAt: 1 });

    return sendSuccess(res, { pr, comments });
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/pulls/:prNumber/conflicts
exports.getConflicts = async (req, res, next) => {
  try {
    const pr = await PullRequest.findOne({ repository: req.repo._id, number: req.params.prNumber });
    if (!pr) return sendError(res, 'Pull request not found', 404);

    const report = await checkPullRequestConflicts(pr._id);
    return sendSuccess(res, report, 'Conflict analysis completed');
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/pulls/:prNumber/resolve
exports.resolveConflicts = async (req, res, next) => {
  try {
    const { resolutions } = req.body;
    const pr = await PullRequest.findOne({ repository: req.repo._id, number: req.params.prNumber });
    if (!pr) return sendError(res, 'Pull request not found', 404);

    const result = await resolveConflictsAndPush(pr._id, req.user._id, resolutions);
    return sendSuccess(res, result, 'Conflicts resolved and committed to source branch');
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/pulls/:prNumber/comments
exports.addComment = async (req, res, next) => {
  try {
    const pr = await PullRequest.findOne({ repository: req.repo._id, number: req.params.prNumber });
    if (!pr) return sendError(res, 'Pull request not found', 404);

    const comment = await PRComment.create({ pullRequest: pr._id, author: req.user._id, body: req.body.body });
    await comment.populate('author', 'username avatar');

    // Notify PR author
    if (!pr.author.equals(req.user._id)) {
      await createNotification({
        recipientId: pr.author,
        actorId: req.user._id,
        type: 'pr_commented',
        message: `${req.user.username} commented on PR #${pr.number}`,
        relatedEntity: pr._id,
        entityModel: 'PullRequest',
      });
    }

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'pr_commented',
      metadata: { prNumber: pr.number },
    });

    return sendSuccess(res, { comment }, 'Comment added', 201);
  } catch (err) {
    next(err);
  }
};

// PUT /api/repos/:owner/:name/pulls/:prNumber/merge
exports.mergePR = async (req, res, next) => {
  try {
    const pr = await PullRequest.findOne({ repository: req.repo._id, number: req.params.prNumber });
    if (!pr) return sendError(res, 'Pull request not found', 404);

    const userRole = req.membership?.role || 'developer';
    const result = await mergePullRequest(pr._id, req.user._id, userRole);
    return sendSuccess(res, result, 'Pull request merged successfully');
  } catch (err) {
    next(err);
  }
};

// PUT /api/repos/:owner/:name/pulls/:prNumber/close
exports.closePR = async (req, res, next) => {
  try {
    const pr = await PullRequest.findOneAndUpdate(
      { repository: req.repo._id, number: req.params.prNumber, status: 'open' },
      { status: 'closed', closedAt: new Date() },
      { new: true }
    );
    if (!pr) return sendError(res, 'Pull request not found or already closed', 404);

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'pr_closed',
      metadata: { prNumber: pr.number },
    });
    return sendSuccess(res, { pr }, 'Pull request closed');
  } catch (err) {
    next(err);
  }
};
