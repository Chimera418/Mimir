const express = require('express');
const { getProfile, updateProfile, changePassword, getNotifications, markNotificationsRead, getActivity } = require('../controllers/userController');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.put('/me', protect, updateProfile);
router.put('/me/password', protect, changePassword);
router.get('/me/notifications', protect, getNotifications);
router.put('/me/notifications/read', protect, markNotificationsRead);
router.get('/me/activity', protect, getActivity);
router.get('/:username', optionalAuth, getProfile);

module.exports = router;
