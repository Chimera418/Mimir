const express = require('express');
const {
  getCommitsPerRepo,
  getCommitsPerUser,
  getTopContributors,
  getRepoMostModifiedFiles,
  getRepoBranchStats,
  getRepoMergeStats,
  getRepoPRStats,
  getRepoIssueStats,
  getRepoTimeline,
  getRepoGrowth,
  getUserContributions,
  getFileHistory,
  getBranchAgeDistribution,
  getConflictStats,
  getContributorFileOwnership,
} = require('../controllers/analyticsController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveRepo } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

// Global
router.get('/global/commits-per-repo', optionalAuth, getCommitsPerRepo);
router.get('/global/commits-per-user', optionalAuth, getCommitsPerUser);
router.get('/global/top-contributors', optionalAuth, getTopContributors);

// User
router.get('/users/:id/contributions', optionalAuth, getUserContributions);

// Repo
router.get('/repos/:owner/:name/modified-files', optionalAuth, resolveRepo, getRepoMostModifiedFiles);
router.get('/repos/:owner/:name/branch-stats', optionalAuth, resolveRepo, getRepoBranchStats);
router.get('/repos/:owner/:name/merge-stats', optionalAuth, resolveRepo, getRepoMergeStats);
router.get('/repos/:owner/:name/pr-stats', optionalAuth, resolveRepo, getRepoPRStats);
router.get('/repos/:owner/:name/issue-stats', optionalAuth, resolveRepo, getRepoIssueStats);
router.get('/repos/:owner/:name/timeline', optionalAuth, resolveRepo, getRepoTimeline);
router.get('/repos/:owner/:name/growth', optionalAuth, resolveRepo, getRepoGrowth);
router.get('/repos/:owner/:name/file-history', optionalAuth, resolveRepo, getFileHistory);
router.get('/repos/:owner/:name/branch-age', optionalAuth, resolveRepo, getBranchAgeDistribution);
router.get('/repos/:owner/:name/conflict-stats', optionalAuth, resolveRepo, getConflictStats);
router.get('/repos/:owner/:name/file-ownership', optionalAuth, resolveRepo, getContributorFileOwnership);

module.exports = router;
