const File = require('../models/File');
const FileVersion = require('../models/FileVersion');
const Branch = require('../models/Branch');
const Commit = require('../models/Commit');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// GET /api/repos/:owner/:name/tree/:branchName  — file list at branch HEAD
exports.listFiles = async (req, res, next) => {
  try {
    const branch = await Branch.findOne({ repository: req.repo._id, name: req.params.branchName });
    if (!branch) return sendError(res, 'Branch not found', 404);
    if (!branch.headCommit) return sendSuccess(res, { files: [] });

    const commit = await Commit.findById(branch.headCommit).populate({
      path: 'tree.fileVersion',
      select: 'filePath contentHash fileSize createdAt'
    });
    
    const fileVersions = (commit.tree || []).map(t => t.fileVersion).filter(Boolean);

    // Build tree structure
    const tree = {};
    for (const fv of fileVersions) {
      const parts = fv.filePath.split('/');
      let node = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]]) node[parts[i]] = { type: 'dir', children: {}, name: parts[i] };
        node = node[parts[i]].children;
      }
      const filename = parts[parts.length - 1];
      node[filename] = {
        type: 'file',
        name: filename,
        path: fv.filePath,
        size: fv.fileSize,
        contentHash: fv.contentHash,
      };
    }

    return sendSuccess(res, { branch: branch.name, headCommit: branch.headCommit, tree, files: fileVersions });
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/blob/:branchName/*filePath  — file content
exports.getFileContent = async (req, res, next) => {
  try {
    const filePath = Array.isArray(req.params.filePath) ? req.params.filePath.join('/') : req.params.filePath;
    const branch = await Branch.findOne({ repository: req.repo._id, name: req.params.branchName });
    if (!branch) return sendError(res, 'Branch not found', 404);
    if (!branch.headCommit) return sendError(res, 'Branch has no commits', 404);

    const commit = await Commit.findById(branch.headCommit);
    if (!commit) return sendError(res, 'Commit not found', 404);

    const fvEntry = (commit.tree || []).find(t => t.path === filePath);
    if (!fvEntry) return sendError(res, 'File not found', 404);

    const fileVersion = await FileVersion.findById(fvEntry.fileVersion);
    if (!fileVersion) return sendError(res, 'File not found', 404);

    return sendSuccess(res, { fileVersion });
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/history/*filePath  — file version history
exports.getFileHistory = async (req, res, next) => {
  try {
    const filePath = Array.isArray(req.params.filePath) ? req.params.filePath.join('/') : req.params.filePath;
    const file = await File.findOne({ repository: req.repo._id, path: filePath });
    if (!file) return sendError(res, 'File not found', 404);

    const versions = await FileVersion.find({ file: file._id })
      .populate({ path: 'commit', populate: { path: 'author', select: 'username avatar' } })
      .sort({ versionNumber: -1 });

    return sendSuccess(res, { file, versions });
  } catch (err) {
    next(err);
  }
};

// GET /api/repos/:owner/:name/compare/:sha1/:sha2  — diff two commits
exports.compareCommits = async (req, res, next) => {
  try {
    const { sha1, sha2 } = req.params;

    const [commit1, commit2] = await Promise.all([
      Commit.findOne({ repository: req.repo._id, sha: sha1 }).populate('tree.fileVersion', 'filePath content contentHash'),
      Commit.findOne({ repository: req.repo._id, sha: sha2 }).populate('tree.fileVersion', 'filePath content contentHash'),
    ]);

    if (!commit1) return sendError(res, `Commit ${sha1} not found`, 404);
    if (!commit2) return sendError(res, `Commit ${sha2} not found`, 404);

    const files1 = (commit1.tree || []).map(t => t.fileVersion).filter(Boolean);
    const files2 = (commit2.tree || []).map(t => t.fileVersion).filter(Boolean);

    const map1 = Object.fromEntries(files1.map((f) => [f.filePath, f]));
    const map2 = Object.fromEntries(files2.map((f) => [f.filePath, f]));
    const allPaths = new Set([...Object.keys(map1), ...Object.keys(map2)]);

    const diff = [];
    for (const path of allPaths) {
      const f1 = map1[path];
      const f2 = map2[path];
      if (!f1) diff.push({ path, status: 'added', before: null, after: f2.content });
      else if (!f2) diff.push({ path, status: 'deleted', before: f1.content, after: null });
      else if (f1.contentHash !== f2.contentHash) diff.push({ path, status: 'modified', before: f1.content, after: f2.content });
    }

    return sendSuccess(res, { commit1, commit2, diff, filesChanged: diff.length });
  } catch (err) {
    next(err);
  }
};
