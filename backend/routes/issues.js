const express = require('express');
const { createIssue, listIssues, getIssue, addComment, closeIssue, reopenIssue, updateIssue } = require('../controllers/issueController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveRepo, requireRole } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

router.post('/', protect, resolveRepo, requireRole('viewer', 'developer', 'maintainer', 'owner'), createIssue);
router.get('/', optionalAuth, resolveRepo, listIssues);
router.get('/:issueNumber', optionalAuth, resolveRepo, getIssue);
router.put('/:issueNumber', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), updateIssue);
router.post('/:issueNumber/comments', protect, resolveRepo, requireRole('viewer', 'developer', 'maintainer', 'owner'), addComment);
router.put('/:issueNumber/close', protect, resolveRepo, requireRole('maintainer', 'owner'), closeIssue);
router.put('/:issueNumber/reopen', protect, resolveRepo, requireRole('maintainer', 'owner'), reopenIssue);

module.exports = router;

