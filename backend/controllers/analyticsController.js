const Commit = require('../models/Commit');
const FileVersion = require('../models/FileVersion');
const Branch = require('../models/Branch');
const MergeOperation = require('../models/MergeOperation');
const PullRequest = require('../models/PullRequest');
const Issue = require('../models/Issue');
const ActivityLog = require('../models/ActivityLog');
const mongoose = require('mongoose');
const { sendSuccess } = require('../utils/apiResponse');

// Global Analytics (for admin dashboard or global stats)
exports.getCommitsPerRepo = async (req, res, next) => {
  try {
    const data = await Commit.aggregate([
      { $group: { _id: '$repository', count: { $sum: 1 } } },
      { $lookup: { from: 'repositories', localField: '_id', foreignField: '_id', as: 'repo' } },
      { $unwind: '$repo' },
      { $project: { _id: 0, repository: '$repo.name', count: 1 } },
      { $sort: { count: -1 } },
    ]);
    return sendSuccess(res, { data });
  } catch (err) {
    next(err);
  }
};

exports.getCommitsPerUser = async (req, res, next) => {
  try {
    const data = await Commit.aggregate([
      { $group: { _id: '$author', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, username: '$user.username', count: 1 } },
      { $sort: { count: -1 } },
    ]);
    return sendSuccess(res, { data });
  } catch (err) {
    next(err);
  }
};

exports.getTopContributors = async (req, res, next) => {
  try {
    const data = await Commit.aggregate([
      { $group: { _id: '$author', commits: { $sum: 1 } } },
      { $sort: { commits: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, username: '$user.username', avatar: '$user.avatar', commits: 1 } },
    ]);
    return sendSuccess(res, { data });
  } catch (err) {
    next(err);
  }
};

// Repository-Specific Analytics (Requires resolveRepo middleware)
exports.getRepoMostModifiedFiles = async (req, res, next) => {
  try {
    const data = await FileVersion.aggregate([
      { $match: { repository: req.repo._id } },
      { $group: { _id: '$filePath', changes: { $sum: 1 } } },
      { $sort: { changes: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, file: '$_id', changes: 1 } },
    ]);
    return sendSuccess(res, { data });
  } catch (err) {
    next(err);
  }
};

exports.getRepoBranchStats = async (req, res, next) => {
  try {
    const count = await Branch.countDocuments({ repository: req.repo._id });
    return sendSuccess(res, { branches: count });
  } catch (err) {
    next(err);
  }
};

exports.getRepoMergeStats = async (req, res, next) => {
  try {
    const data = await MergeOperation.aggregate([
      { $match: { repository: req.repo._id } },
      { $group: { _id: '$strategy', count: { $sum: 1 } } },
    ]);
    const formatted = data.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, { merge: 0, squash: 0, rebase: 0 });
    return sendSuccess(res, { merges: formatted });
  } catch (err) {
    next(err);
  }
};

exports.getRepoPRStats = async (req, res, next) => {
  try {
    const data = await PullRequest.aggregate([
      { $match: { repository: req.repo._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const formatted = data.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, { open: 0, merged: 0, closed: 0 });
    return sendSuccess(res, { pullRequests: formatted });
  } catch (err) {
    next(err);
  }
};

exports.getRepoIssueStats = async (req, res, next) => {
  try {
    const data = await Issue.aggregate([
      { $match: { repository: req.repo._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const formatted = data.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, { open: 0, closed: 0 });
    return sendSuccess(res, { issues: formatted });
  } catch (err) {
    next(err);
  }
};

exports.getRepoTimeline = async (req, res, next) => {
  try {
    const data = await ActivityLog.aggregate([
      { $match: { repository: req.repo._id } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          events: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', events: 1 } },
    ]);
    return sendSuccess(res, { timeline: data });
  } catch (err) {
    next(err);
  }
};

exports.getRepoGrowth = async (req, res, next) => {
  try {
    // Cumulative commits over time (by month)
    const data = await Commit.aggregate([
      { $match: { repository: req.repo._id } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Calculate cumulative sum
    let total = 0;
    const growth = data.map(item => {
      total += item.count;
      return {
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        commits: total
      };
    });

    return sendSuccess(res, { growth });
  } catch (err) {
    next(err);
  }
};

// User-Specific Analytics (Requires user id)
exports.getUserContributions = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.id);
    const data = await Commit.aggregate([
      { $match: { author: userId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ]);
    return sendSuccess(res, { contributions: data });
  } catch (err) {
    next(err);
  }
};

// Global File History Across All Branches
exports.getFileHistory = async (req, res, next) => {
  try {
    const filePath = req.query.path;
    const filter = { repository: req.repo._id };
    if (filePath) filter.filePath = filePath;

    const versions = await FileVersion.find(filter)
      .sort({ createdAt: -1 })
      .populate({
        path: 'commit',
        select: 'sha message author branch isMergeCommit createdAt',
        populate: [
          { path: 'author', select: 'username avatar' },
          { path: 'branch', select: 'name' }
        ]
      })
      .limit(100);

    return sendSuccess(res, { filePath: filePath || null, versions });
  } catch (err) {
    next(err);
  }
};

// Branch Age & Activity Distribution
exports.getBranchAgeDistribution = async (req, res, next) => {
  try {
    const branches = await Branch.find({ repository: req.repo._id })
      .populate('creator', 'username avatar')
      .populate('headCommit', 'sha message createdAt')
      .sort({ createdAt: -1 });

    const now = Date.now();
    const data = branches.map((b) => ({
      _id: b._id,
      name: b.name,
      isDefault: b.isDefault,
      isProtected: b.isProtected,
      creator: b.creator?.username || 'unknown',
      headSha: b.headCommit?.sha ? b.headCommit.sha.slice(0, 8) : null,
      lastCommitMessage: b.headCommit?.message || null,
      createdAt: b.createdAt,
      ageDays: Math.max(0, Math.floor((now - new Date(b.createdAt).getTime()) / 86400000)),
    }));

    return sendSuccess(res, { branches: data });
  } catch (err) {
    next(err);
  }
};

// Merge Conflict & Security Anomaly Statistics
exports.getConflictStats = async (req, res, next) => {
  try {
    // Audit actions where conflict resolution commits or security violations occurred
    const conflictResolutions = await ActivityLog.aggregate([
      {
        $match: {
          repository: req.repo._id,
          action: 'commit_created',
          'metadata.message': { $regex: /^Resolve merge conflicts/i }
        }
      },
      { $count: 'total' }
    ]);

    const securityViolations = await ActivityLog.aggregate([
      { $match: { repository: req.repo._id, action: 'security_violation' } },
      { $group: { _id: '$metadata.reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const conflictCommits = await Commit.find({
      repository: req.repo._id,
      message: { $regex: /^Resolve merge conflicts/i }
    })
      .select('_id sha message createdAt author')
      .populate('author', 'username')
      .sort({ createdAt: -1 });

    let hotConflictFiles = [];
    if (conflictCommits.length > 0) {
      const commitIds = conflictCommits.map((c) => c._id);
      hotConflictFiles = await FileVersion.aggregate([
        { $match: { repository: req.repo._id, commit: { $in: commitIds } } },
        { $group: { _id: '$filePath', conflictCount: { $sum: 1 } } },
        { $sort: { conflictCount: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, file: '$_id', conflictCount: 1 } }
      ]);
    }

    return sendSuccess(res, {
      totalConflictResolutions: conflictResolutions[0]?.total || conflictCommits.length || 0,
      securityViolations: securityViolations.map((v) => ({ reason: v._id, count: v.count })),
      hotConflictFiles,
      conflictCommits: conflictCommits.slice(0, 10).map((c) => ({
        sha: c.sha.slice(0, 8),
        message: c.message,
        author: c.author?.username || 'unknown',
        createdAt: c.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
};

// Contributor Code Ownership Heatmap per File
exports.getContributorFileOwnership = async (req, res, next) => {
  try {
    const data = await FileVersion.aggregate([
      { $match: { repository: req.repo._id } },
      { $lookup: { from: 'commits', localField: 'commit', foreignField: '_id', as: 'commitDoc' } },
      { $unwind: '$commitDoc' },
      { $lookup: { from: 'users', localField: 'commitDoc.author', foreignField: '_id', as: 'authorDoc' } },
      { $unwind: '$authorDoc' },
      { $group: { _id: { file: '$filePath', author: '$authorDoc.username' }, edits: { $sum: 1 } } },
      { $sort: { edits: -1 } },
      { $limit: 60 },
      { $project: { _id: 0, file: '$_id.file', author: '$_id.author', edits: 1 } }
    ]);

    const byFile = {};
    data.forEach(({ file, author, edits }) => {
      if (!byFile[file]) byFile[file] = [];
      byFile[file].push({ author, edits });
    });

    const ownership = Object.entries(byFile).map(([file, contributors]) => {
      const totalEdits = contributors.reduce((sum, c) => sum + c.edits, 0);
      return {
        file,
        totalEdits,
        contributors: contributors.map((c) => ({
          ...c,
          percentage: Math.round((c.edits / totalEdits) * 100)
        }))
      };
    });

    return sendSuccess(res, { ownership });
  } catch (err) {
    next(err);
  }
};
