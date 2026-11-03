const express = require('express');
const { createRepository, listRepositories, getRepository, updateRepository, archiveRepository, deleteRepository, listCollaborators, addCollaborator, removeCollaborator } = require('../controllers/repositoryController');
const { protect, optionalAuth } = require('../middleware/auth');
const { resolveRepo, requireRole } = require('../middleware/permissions');

const router = express.Router();

router.post('/', protect, createRepository);
router.get('/', optionalAuth, listRepositories);

router.get('/:owner/:name', optionalAuth, resolveRepo, getRepository);
router.put('/:owner/:name', protect, resolveRepo, requireRole('maintainer', 'owner'), updateRepository);
router.delete('/:owner/:name', protect, resolveRepo, requireRole('owner'), deleteRepository);
router.put('/:owner/:name/archive', protect, resolveRepo, requireRole('owner'), archiveRepository);

router.get('/:owner/:name/collaborators', protect, resolveRepo, requireRole('viewer', 'developer', 'maintainer', 'owner'), listCollaborators);
router.post('/:owner/:name/collaborators', protect, resolveRepo, requireRole('owner'), addCollaborator);
router.delete('/:owner/:name/collaborators/:userId', protect, resolveRepo, requireRole('owner'), removeCollaborator);

module.exports = router;
