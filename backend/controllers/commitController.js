const Branch = require('../models/Branch');
const Commit = require('../models/Commit');
const FileVersion = require('../models/FileVersion');
const { createCommit, getCommitHistory, getCommitDAG } = require('../services/commitService');
const { revertCommit } = require('../services/recoveryService');
const { logActivity } = require('../services/activityService');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');

// POST /api/repos/:owner/:name/commits
exports.createCommit = async (req, res, next) => {
  try {
    const { branchName, message, files } = req.body;
    const simulateFailure = req.query.simulateFailure === 'true' || req.body.simulateFailure === true;

    if (!message) return sendError(res, 'Commit message is required', 400);
    if (!files || !Array.isArray(files) || files.length === 0) {
      return sendError(res, 'At least one file is required', 400);
    }

    const branch = await Branch.findOne({ repository: req.repo._id, name: branchName || req.repo.defaultBranch });
    if (!branch) return sendError(res, 'Branch not found', 404);

    // Backend-enforced Branch Protection Rule
    if (branch.isProtected && req.membership?.role === 'developer') {
      await logActivity({
        userId: req.user._id,
        repositoryId: req.repo._id,
        action: 'security_violation',
        metadata: {
          reason: 'Unauthorized direct commit attempt on protected branch',
          branch: branch.name,
          userRole: req.membership?.role,
        },
      });
      return sendError(res, 'This branch is protected — only maintainers and owners can commit directly', 403);
    }

    const parentCommitIds = branch.headCommit ? [branch.headCommit] : [];

    const commit = await createCommit({
      repoId: req.repo._id,
      branchId: branch._id,
      authorId: req.user._id,
      message,
      files,
      parentCommitIds,
      simulateFailure,
    });

    const populated = await Commit.findById(commit._id)
      .populate('author', 'username avatar')
      .populate('branch', 'name');

    return sendSuccess(res, { commit: populated }, 'Commit created', 201);
  } catch (err) {
    if (err.isSimulated) {
      return res.status(500).json({
        success: false,
        isSimulated: true,
        message: err.message,
        demonstration: 'ACID Atomicity verified: transaction aborted and all partial state rolled back cleanly.',
      });
    }
    next(err);
  }
};

// GET /api/repos/:owner/:name/commits?branch=main&page=1&limit=20
exports.listCommits = async (req, res, next) => {
  try {
    const branchName = req.query.branch || req.repo.defaultBranch;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const branch = await Branch.findOne({ repository: req.repo._id, name: branchName });
    if (!branch) return sendError(res, 'Branch not found', 404);

    const { commits, total } = await getCommitHistory(branch._id, page, limit);
    return sendPaginated(res, commits, page, limit, total);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/commits/:sha
exports.getCommit = async (req, res, next) => {
  try {
    const commit = await Commit.findOne({ repository: req.repo._id, sha: req.params.sha })
      .populate('author', 'username avatar')
      .populate('branch', 'name')
      .populate('parentCommits', 'sha message');

    if (!commit) return sendError(res, 'Commit not found', 404);

    // Get files changed in this commit
    const fileVersions = await FileVersion.find({ commit: commit._id })
      .select('filePath contentHash versionNumber fileSize');

    return sendSuccess(res, { commit, fileVersions });
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/commits/dag  — full DAG for visualization
exports.getDAG = async (req, res, next) => {
  try {
    const dag = await getCommitDAG(req.repo._id);
    return sendSuccess(res, { dag });
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/commits/:sha/revert
exports.revertCommitHandler = async (req, res, next) => {
  try {
    const { branchName, reason } = req.body;
    const targetBranchName = branchName || req.repo.defaultBranch || 'main';

    const branch = await Branch.findOne({ repository: req.repo._id, name: targetBranchName });
    if (!branch) return sendError(res, `Branch '${targetBranchName}' not found`, 404);

    if (branch.isProtected && req.membership?.role === 'developer') {
      await logActivity({
        userId: req.user._id,
        repositoryId: req.repo._id,
        action: 'security_violation',
        metadata: {
          reason: 'Unauthorized revert attempt on protected branch',
          branch: branch.name,
        },
      });
      return sendError(res, 'Cannot revert on a protected branch without maintainer privileges', 403);
    }

    const result = await revertCommit({
      repoId: req.repo._id,
      branchName: targetBranchName,
      targetSha: req.params.sha,
      userId: req.user._id,
      reason,
    });

    return sendSuccess(res, result, 'Commit successfully reverted with a forward recovery commit');
  } catch (err) {
    next(err);
  }
};
