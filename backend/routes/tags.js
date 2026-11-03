const express = require('express');
const { createTag, listTags, createRelease, listReleases } = require('../controllers/tagController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveRepo, requireRole } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

router.post('/tags', protect, resolveRepo, requireRole('maintainer', 'owner'), createTag);
router.get('/tags', optionalAuth, resolveRepo, listTags);

router.post('/releases', protect, resolveRepo, requireRole('maintainer', 'owner'), createRelease);
router.get('/releases', optionalAuth, resolveRepo, listReleases);

module.exports = router;
