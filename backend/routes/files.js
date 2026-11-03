const express = require('express');
const { listFiles, getFileContent, getFileHistory, compareCommits } = require('../controllers/fileController');
const { optionalAuth } = require('../middleware/auth');
const { resolveRepo } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

router.get('/tree/:branchName', optionalAuth, resolveRepo, listFiles);
router.get('/blob/:branchName/*filePath', optionalAuth, resolveRepo, getFileContent);
router.get('/history/*filePath', optionalAuth, resolveRepo, getFileHistory);
router.get('/compare/:sha1/:sha2', optionalAuth, resolveRepo, compareCommits);

module.exports = router;
