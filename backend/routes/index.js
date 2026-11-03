const express = require('express');

const authRoutes = require('./auth');
const userRoutes = require('./users');
const repoRoutes = require('./repositories');
const branchRoutes = require('./branches');
const commitRoutes = require('./commits');
const fileRoutes = require('./files');
const prRoutes = require('./pullRequests');
const issueRoutes = require('./issues');
const tagRoutes = require('./tags');
const analyticsRoutes = require('./analytics');
const searchRoutes = require('./search');
const integrityRoutes = require('./integrity');
const auditRoutes = require('./audit');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/repos', repoRoutes);
router.use('/repos/:owner/:name/branches', branchRoutes);
router.use('/repos/:owner/:name/commits', commitRoutes);
router.use('/repos/:owner/:name/integrity', integrityRoutes);
router.use('/repos/:owner/:name/audit', auditRoutes);
router.use('/repos/:owner/:name', fileRoutes); // files/blobs/trees mapped at repo level
router.use('/repos/:owner/:name/pulls', prRoutes);
router.use('/repos/:owner/:name/issues', issueRoutes);
router.use('/repos/:owner/:name', tagRoutes); // tags and releases
router.use('/analytics', analyticsRoutes);
router.use('/search', searchRoutes);

module.exports = router;
