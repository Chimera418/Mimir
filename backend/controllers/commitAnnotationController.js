const CommitAnnotation = require('../models/CommitAnnotation');
const Commit = require('../models/Commit');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { logActivity } = require('../services/activityService');

// GET /api/repos/:owner/:name/commits/:sha/annotations
exports.listAnnotations = async (req, res, next) => {
  try {
    const commit = await Commit.findOne({ repository: req.repo._id, sha: req.params.sha });
    if (!commit) return sendError(res, 'Commit not found', 404);

    const annotations = await CommitAnnotation.find({ repository: req.repo._id, commit: commit._id })
      .populate('author', 'username avatar')
      .sort({ createdAt: 1 });

    return sendSuccess(res, {
      annotations,
      commit: { sha: commit.sha, message: commit.message }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/commits/:sha/annotations
exports.createAnnotation = async (req, res, next) => {
  try {
    const { body, filePath } = req.body;
    if (!body || !body.trim()) {
      return sendError(res, 'Annotation body is required', 400);
    }

    const commit = await Commit.findOne({ repository: req.repo._id, sha: req.params.sha });
    if (!commit) return sendError(res, 'Commit not found', 404);

    const annotation = await CommitAnnotation.create({
      repository: req.repo._id,
      commit: commit._id,
      author: req.user._id,
      body: body.trim(),
      filePath: filePath || null,
    });

    await annotation.populate('author', 'username avatar');

    await logActivity({
      userId: req.user._id,
      repositoryId: req.repo._id,
      action: 'commit_created',
      metadata: {
        type: 'commit_annotation',
        sha: commit.sha.slice(0, 8),
        annotationId: annotation._id,
      },
      entityId: commit._id,
      entityModel: 'Commit',
    });

    return sendSuccess(res, { annotation }, 'Annotation added to commit', 201);
  } catch (err) {
    next(err);
  }
};

