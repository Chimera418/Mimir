const express = require('express');
const { getAuditLog } = require('../controllers/auditController');
const { protect } = require('../middleware/auth');
const { resolveRepo, requireRole } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

// Viewers, developers, maintainers, and owners can view the audit trail
router.get('/', protect, resolveRepo, requireRole('viewer', 'developer', 'maintainer', 'owner'), getAuditLog);

module.exports = router;
