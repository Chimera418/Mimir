const express = require('express');
const { createCommit, listCommits, getCommit, getDAG, revertCommitHandler } = require('../controllers/commitController');
const { listAnnotations, createAnnotation } = require('../controllers/commitAnnotationController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveRepo, requireRole } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

router.post('/', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), createCommit);
router.get('/', optionalAuth, resolveRepo, listCommits);
router.get('/dag', optionalAuth, resolveRepo, getDAG);
router.get('/:sha', optionalAuth, resolveRepo, getCommit);
router.post('/:sha/revert', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), revertCommitHandler);
router.get('/:sha/annotations', optionalAuth, resolveRepo, listAnnotations);
router.post('/:sha/annotations', protect, resolveRepo, requireRole('viewer', 'developer', 'maintainer', 'owner'), createAnnotation);

module.exports = router;
