const express = require('express');
const {
  verifyIntegrity,
  verifySingleCommit,
  simulateTamper,
  healTamper,
} = require('../controllers/integrityController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveRepo, requireRole } = require('../middleware/permissions');

const router = express.Router({ mergeParams: true });

router.get('/', optionalAuth, resolveRepo, verifyIntegrity);
router.get('/verify', optionalAuth, resolveRepo, verifyIntegrity);
router.get('/commit/:sha', optionalAuth, resolveRepo, verifySingleCommit);
router.post('/simulate-tamper', protect, resolveRepo, requireRole('maintainer', 'owner'), simulateTamper);
router.post('/tamper', protect, resolveRepo, requireRole('maintainer', 'owner'), simulateTamper);
router.post('/heal', protect, resolveRepo, requireRole('maintainer', 'owner'), healTamper);

module.exports = router;
