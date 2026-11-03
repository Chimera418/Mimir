const express = require('express');
const { listBranches, createBranch, deleteBranch, toggleProtection } = require('../controllers/branchController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveRepo, requireRole } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

router.get('/', optionalAuth, resolveRepo, listBranches);
router.post('/', protect, resolveRepo, requireRole('developer', 'maintainer', 'owner'), createBranch);
router.delete('/:branchName', protect, resolveRepo, requireRole('maintainer', 'owner'), deleteBranch);
router.put('/:branchName/protect', protect, resolveRepo, requireRole('maintainer', 'owner'), toggleProtection);

module.exports = router;
