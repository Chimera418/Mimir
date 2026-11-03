const { verifyRepositoryHistory, simulateTampering, healTamperedCommit, verifyCommitIntegrity } = require('../services/integrityService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// GET /api/repos/:owner/:name/integrity?branch=main
exports.verifyIntegrity = async (req, res, next) => {
  try {
    const branchName = req.query.branch || req.repo.defaultBranch || 'main';
    const report = await verifyRepositoryHistory(req.repo._id, branchName, req.user?._id);
    return sendSuccess(res, report, 'Cryptographic integrity verification complete');
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/integrity/commit/:sha
exports.verifySingleCommit = async (req, res, next) => {
  try {
    const Commit = require('../models/Commit');
    const commit = await Commit.findOne({ repository: req.repo._id, sha: req.params.sha });
    if (!commit) return sendError(res, 'Commit not found', 404);

    const report = await verifyCommitIntegrity(commit._id);
    return sendSuccess(res, report, 'Commit verification complete');
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/integrity/simulate-tamper
exports.simulateTamper = async (req, res, next) => {
  try {
    const { commitSha, tamperType = 'file_content' } = req.body;
    if (!commitSha) return sendError(res, 'commitSha is required', 400);

    const result = await simulateTampering(req.repo._id, { commitSha, tamperType });
    return sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

// POST /api/repos/:owner/:name/integrity/heal
exports.healTamper = async (req, res, next) => {
  try {
    const { commitSha } = req.body;
    if (!commitSha) return sendError(res, 'commitSha is required', 400);

    const result = await healTamperedCommit(req.repo._id, { commitSha });
    return sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};
