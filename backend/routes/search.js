const express = require('express');
const { globalSearch } = require('../controllers/searchController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, globalSearch);

module.exports = router;
