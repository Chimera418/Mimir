const mongoose = require('mongoose');
const Repository = require('../models/Repository');
const RepositoryMember = require('../models/RepositoryMember');
const Branch = require('../models/Branch');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { logActivity, createNotification } = require('../services/activityService');

// POST /api/repos
exports.createRepository = async (req, res, next) => {
  try {
    const { name, description, visibility, defaultBranch = 'main' } = req.body;
    if (!name) return sendError(res, 'Repository name is required', 400);

    const repo = await Repository.create({ name, description, visibility, owner: req.user._id, defaultBranch });

    // Add owner as member
    await RepositoryMember.create({ repository: repo._id, user: req.user._id, role: 'owner' });

    // Create the default branch
    await Branch.create({ repository: repo._id, name: defaultBranch, creator: req.user._id, isDefault: true });

    await logActivity({ userId: req.user._id, repositoryId: repo._id, action: 'repo_created', metadata: { name } });

    return sendSuccess(res, { repo }, 'Repository created', 201);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos  — list public repos or authenticated user's repos
exports.listRepositories = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.q;

    const filter = req.user
      ? { $or: [{ visibility: 'public' }, { owner: req.user._id }] }
      : { visibility: 'public' };

    if (search) filter.$text = { $search: search };

    const repos = await Repository.find(filter)
      .populate('owner', 'username avatar')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Repository.countDocuments(filter);
    return sendPaginated(res, repos, page, limit, total);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name
exports.getRepository = async (req, res, next) => {
  try {
    const repo = req.repo;
    const branches = await Branch.find({ repository: repo._id }).sort({ isDefault: -1, name: 1 });
    const memberCount = await RepositoryMember.countDocuments({ repository: repo._id });
    return sendSuccess(res, { repo, branches, memberCount });
  } catch (err) {
    next(err);
  }
};

// PUT /api/repos/:owner/:name
exports.updateRepository = async (req, res, next) => {
  try {
    const { description, visibility, defaultBranch } = req.body;
    const updates = {};
    if (description !== undefined) updates.description = description;
    if (visibility !== undefined) updates.visibility = visibility;
    if (defaultBranch !== undefined) updates.defaultBranch = defaultBranch;

    const repo = await Repository.findByIdAndUpdate(req.repo._id, updates, { new: true, runValidators: true });
    await logActivity({ userId: req.user._id, repositoryId: repo._id, action: 'repo_updated', metadata: updates });
    return sendSuccess(res, { repo }, 'Repository updated');
  } catch (err) {
    next(err);
  }
};

// PUT /api/repos/:owner/:name/archive
exports.archiveRepository = async (req, res, next) => {
  try {
    const repo = await Repository.findByIdAndUpdate(
      req.repo._id,
      { isArchived: !req.repo.isArchived },
      { new: true }
    );
    await logActivity({ userId: req.user._id, repositoryId: repo._id, action: 'repo_archived', metadata: { isArchived: repo.isArchived } });
    return sendSuccess(res, { repo }, `Repository ${repo.isArchived ? 'archived' : 'unarchived'}`);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/repos/:owner/:name
exports.deleteRepository = async (req, res, next) => {
  try {
    // Cascade: delete all related documents
    const repoId = req.repo._id;
    await Promise.all([
      RepositoryMember.deleteMany({ repository: repoId }),
      Branch.deleteMany({ repository: repoId }),
      require('../models/Commit').deleteMany({ repository: repoId }),
      require('../models/File').deleteMany({ repository: repoId }),
      require('../models/FileVersion').deleteMany({ repository: repoId }),
      require('../models/PullRequest').deleteMany({ repository: repoId }),
      require('../models/Issue').deleteMany({ repository: repoId }),
      require('../models/Tag').deleteMany({ repository: repoId }),
    ]);
    await Repository.findByIdAndDelete(repoId);
    await logActivity({ userId: req.user._id, action: 'repo_deleted', metadata: { name: req.repo.name } });
    return sendSuccess(res, {}, 'Repository deleted');
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/collaborators
exports.listCollaborators = async (req, res, next) => {
  try {
    const members = await RepositoryMember.find({ repository: req.repo._id })
      .populate('user', 'username avatar email')
      .populate('invitedBy', 'username');
    return sendSuccess(res, { members });
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/collaborators
exports.addCollaborator = async (req, res, next) => {
  try {
    const { username, role = 'developer' } = req.body;
    const userToAdd = await User.findOne({ username });
    if (!userToAdd) return sendError(res, 'User not found', 404);

    const existing = await RepositoryMember.findOne({ repository: req.repo._id, user: userToAdd._id });
    if (existing) return sendError(res, 'User is already a collaborator', 409);

    const member = await RepositoryMember.create({
      repository: req.repo._id,
      user: userToAdd._id,
      role,
      invitedBy: req.user._id,
    });

    await createNotification({
      recipientId: userToAdd._id,
      actorId: req.user._id,
      type: 'collaborator_added',
      message: `${req.user.username} added you as a collaborator to ${req.repo.name}`,
      relatedEntity: req.repo._id,
      entityModel: 'Repository',
    });

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'collaborator_added',
      metadata: { username, role },
    });

    return sendSuccess(res, { member }, 'Collaborator added', 201);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/repos/:owner/:name/collaborators/:userId
exports.removeCollaborator = async (req, res, next) => {
  try {
    const member = await RepositoryMember.findOne({
      repository: req.repo._id,
      user: req.params.userId,
    });
    if (!member) return sendError(res, 'Collaborator not found', 404);
    if (member.role === 'owner') return sendError(res, 'Cannot remove the repository owner', 403);

    await RepositoryMember.findByIdAndDelete(member._id);
    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'collaborator_removed',
      metadata: { removedUserId: req.params.userId },
    });
    return sendSuccess(res, {}, 'Collaborator removed');
  } catch (err) {
    next(err);
  }
};
