const Branch = require('../models/Branch');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { logActivity } = require('../services/activityService');

// GET /api/repos/:owner/:name/branches
exports.listBranches = async (req, res, next) => {
  try {
    const branches = await Branch.find({ repository: req.repo._id })
      .populate('headCommit', 'sha message createdAt')
      .populate('creator', 'username avatar')
      .sort({ isDefault: -1, name: 1 });
    return sendSuccess(res, { branches });
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/branches
exports.createBranch = async (req, res, next) => {
  try {
    const { name, fromBranch } = req.body;
    if (!name) return sendError(res, 'Branch name is required', 400);

    const existing = await Branch.findOne({ repository: req.repo._id, name });
    if (existing) return sendError(res, 'Branch already exists', 409);

    // Get HEAD commit from source branch
    let headCommit = null;
    if (fromBranch) {
      const source = await Branch.findOne({ repository: req.repo._id, name: fromBranch });
      if (!source) return sendError(res, `Source branch '${fromBranch}' not found`, 404);
      headCommit = source.headCommit;
    }

    const branch = await Branch.create({
      repository: req.repo._id,
      name,
      headCommit,
      creator: req.user._id,
    });

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'branch_created',
      metadata: { name, fromBranch },
      entityId: branch._id,
      entityModel: 'Branch',
    });

    return sendSuccess(res, { branch }, 'Branch created', 201);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/repos/:owner/:name/branches/:branchName
exports.deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findOne({ repository: req.repo._id, name: req.params.branchName });
    if (!branch) return sendError(res, 'Branch not found', 404);
    if (branch.isProtected) {
      await logActivity({
        userId: req.user._id,
        repositoryId: req.repo._id,
        action: 'security_violation',
        metadata: {
          reason: 'Attempted deletion of protected branch',
          branch: branch.name,
        },
      });
      return sendError(res, 'Cannot delete a protected branch', 403);
    }
    if (branch.name === req.repo.defaultBranch) return sendError(res, 'Cannot delete the default branch', 403);

    await Branch.findByIdAndDelete(branch._id);
    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'branch_deleted',
      metadata: { name: branch.name },
    });
    return sendSuccess(res, {}, 'Branch deleted');
  } catch (err) {
    next(err);
  }
};

// PUT /api/repos/:owner/:name/branches/:branchName/protect
exports.toggleProtection = async (req, res, next) => {
  try {
    const branch = await Branch.findOne({ repository: req.repo._id, name: req.params.branchName });
    if (!branch) return sendError(res, 'Branch not found', 404);

    branch.isProtected = !branch.isProtected;
    await branch.save();

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: branch.isProtected ? 'branch_protected' : 'branch_unprotected',
      metadata: { name: branch.name, isProtected: branch.isProtected },
      entityId: branch._id,
      entityModel: 'Branch',
    });
    return sendSuccess(res, { branch }, `Branch ${branch.isProtected ? 'protected' : 'unprotected'}`);
  } catch (err) {
    next(err);
  }
};
