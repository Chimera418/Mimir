const express = require('express');
const {
  createPR,
  listPRs,
  getPR,
  getConflicts,
  resolveConflicts,
  addComment,
  mergePR,
  closePR,
} = require('../controllers/pullRequestController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveRepo, requireRole } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

router.post('/', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), createPR);
router.get('/', optionalAuth, resolveRepo, listPRs);
router.get('/:prNumber', optionalAuth, resolveRepo, getPR);
router.get('/:prNumber/conflicts', optionalAuth, resolveRepo, getConflicts);
router.post('/:prNumber/resolve', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), resolveConflicts);
router.post('/:prNumber/resolve-conflicts', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), resolveConflicts);
router.post('/:prNumber/comments', protect, resolveRepo, requireRole('viewer', 'developer', 'maintainer', 'owner'), addComment);
router.put('/:prNumber/merge', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), mergePR);
router.post('/:prNumber/merge', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), mergePR);
router.put('/:prNumber/close', protect, resolveRepo, requireRole('maintainer', 'owner'), closePR);
router.post('/:prNumber/close', protect, resolveRepo, requireRole('maintainer', 'owner'), closePR);

module.exports = router;
