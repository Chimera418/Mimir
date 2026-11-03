const Tag = require('../models/Tag');
const Release = require('../models/Release');
const Commit = require('../models/Commit');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { logActivity, createNotification } = require('../services/activityService');

// POST /api/repos/:owner/:name/tags
exports.createTag = async (req, res, next) => {
  try {
    const { name, commitSha, message } = req.body;
    if (!name || !commitSha) return sendError(res, 'Tag name and commit SHA are required', 400);

    const existing = await Tag.findOne({ repository: req.repo._id, name });
    if (existing) return sendError(res, 'Tag already exists', 409);

    const commit = await Commit.findOne({ repository: req.repo._id, sha: commitSha });
    if (!commit) return sendError(res, 'Commit not found', 404);

    const tag = await Tag.create({
      repository: req.repo._id,
      name,
      commit: commit._id,
      creator: req.user._id,
      message: message || '',
      isAnnotated: !!message,
    });

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'tag_created',
      metadata: { name, commitSha },
      entityId: tag._id,
      entityModel: 'Tag',
    });

    return sendSuccess(res, { tag }, 'Tag created', 201);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/tags
exports.listTags = async (req, res, next) => {
  try {
    const tags = await Tag.find({ repository: req.repo._id })
      .populate('commit', 'sha message')
      .populate('creator', 'username avatar')
      .sort({ createdAt: -1 });

    return sendSuccess(res, { tags });
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/releases
exports.createRelease = async (req, res, next) => {
  try {
    const { tagName, name, body, isDraft = false, isPrerelease = false } = req.body;
    if (!tagName || !name) return sendError(res, 'Tag name and release name are required', 400);

    const tag = await Tag.findOne({ repository: req.repo._id, name: tagName });
    if (!tag) return sendError(res, 'Tag not found', 404);

    const existing = await Release.findOne({ repository: req.repo._id, tag: tag._id });
    if (existing) return sendError(res, 'Release already exists for this tag', 409);

    const release = await Release.create({
      repository: req.repo._id,
      tag: tag._id,
      commit: tag.commit,
      author: req.user._id,
      name,
      body: body || '',
      isDraft,
      isPrerelease,
    });

    if (!isDraft) {
      await logActivity({
        userId: req.user._id,
        repositoryId: req.repo._id,
        action: 'release_created',
        metadata: { name, tagName },
        entityId: release._id,
        entityModel: 'Release',
      });
    }

    return sendSuccess(res, { release }, 'Release created', 201);
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/releases
exports.listReleases = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const releases = await Release.find({ repository: req.repo._id })
      .populate('author', 'username avatar')
      .populate('tag', 'name')
      .populate('commit', 'sha')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Release.countDocuments({ repository: req.repo._id });
    return sendPaginated(res, releases, page, limit, total);
  } catch (err) {
    next(err);
  }
};
