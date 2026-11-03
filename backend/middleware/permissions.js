const RepositoryMember = require('../models/RepositoryMember');
const Repository = require('../models/Repository');
const { sendError } = require('../utils/apiResponse');

const ROLE_HIERARCHY = { viewer: 1, developer: 2, maintainer: 3, owner: 4 };

/**
 * Resolves :owner/:name params to a Repository document.
 * Attaches req.repo and req.membership (if user is a member).
 */
const resolveRepo = async (req, res, next) => {
  try {
    const repo = await Repository.findOne({
      name: req.params.name,
    }).populate('owner', 'username avatar');

    // Must find repo by owner username
    if (!repo) return sendError(res, 'Repository not found', 404);

    const owner = repo.owner;
    if (owner.username !== req.params.owner) return sendError(res, 'Repository not found', 404);

    const isOwner = req.user && (
      (owner._id && owner._id.toString() === req.user._id.toString()) ||
      owner.toString() === req.user._id.toString()
    );

    let membership = null;
    if (req.user) {
      membership = await RepositoryMember.findOne({
        repository: repo._id,
        user: req.user._id,
      });
      if (!membership && isOwner) {
        membership = { role: 'owner', repository: repo._id, user: req.user._id };
      }
    }

    // Check visibility
    if (repo.visibility === 'private') {
      if (!req.user) return sendError(res, 'Repository not found', 404);
      if (!membership) return sendError(res, 'Repository not found', 404);
    }

    req.membership = membership;
    req.repo = repo;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * requireRole factory — ensures req.user has at least minRole in the repo.
 * Usage: router.post('/', protect, resolveRepo, requireRole('developer'), controller)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 'Not authenticated', 401);
    if (!req.membership) return sendError(res, 'You are not a member of this repository', 403);

    const userLevel = ROLE_HIERARCHY[req.membership.role] || 0;
    const minRequired = Math.min(...allowedRoles.map((r) => ROLE_HIERARCHY[r] || 99));

    if (userLevel < minRequired) {
      return sendError(res, `Requires at least ${allowedRoles[0]} role`, 403);
    }
    next();
  };
};

module.exports = { resolveRepo, requireRole };
