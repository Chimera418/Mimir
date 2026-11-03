const User = require('../models/User');
const Repository = require('../models/Repository');
const Commit = require('../models/Commit');
const File = require('../models/File');
const Issue = require('../models/Issue');
const { sendSuccess } = require('../utils/apiResponse');

// GET /api/search?q=term&type=repos,users,commits,files,issues
exports.globalSearch = async (req, res, next) => {
  try {
    const { q, type } = req.query;
    if (!q) return sendSuccess(res, { results: {} });

    const types = type ? type.split(',') : ['repos', 'users', 'commits', 'files', 'issues'];
    const results = {};
    const limit = 5;

    const promises = [];

    if (types.includes('users')) {
      promises.push(
        User.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .select('username avatar bio')
          .then(data => results.users = data)
      );
    }

    if (types.includes('repos')) {
      promises.push(
        Repository.find({ $text: { $search: q }, visibility: 'public' }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .populate('owner', 'username')
          .then(data => results.repos = data)
      );
    }

    if (types.includes('commits')) {
      promises.push(
        Commit.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .populate('repository', 'name owner')
          .populate('author', 'username')
          .then(data => results.commits = data)
      );
    }

    if (types.includes('files')) {
      promises.push(
        File.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .populate('repository', 'name owner')
          .then(data => results.files = data)
      );
    }

    if (types.includes('issues')) {
      promises.push(
        Issue.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .populate('repository', 'name owner')
          .then(data => results.issues = data)
      );
    }

    await Promise.all(promises);

    return sendSuccess(res, { results });
  } catch (err) {
    next(err);
  }
};
