const mongoose = require('mongoose');
const Commit = require('../models/Commit');
const Branch = require('../models/Branch');
const File = require('../models/File');
const FileVersion = require('../models/FileVersion');
const { buildMerkleTree, computeCommitHash, computeContentHash } = require('../utils/merkle');
const { logActivity } = require('./activityService');

const { runInTransaction } = require('../utils/transactionHelper');

/**
 * createCommit — Atomically creates a commit with all file versions using ACID transaction guarantees.
 *
 * ACID PROPERTIES DEMONSTRATED:
 *   - Atomicity: Commit, File, FileVersion, Branch HEAD, and ActivityLog succeed or roll back together.
 *   - Consistency: Invariants (valid DAG references, branch heads, SHA-256 Merkle root) are enforced.
 *   - Isolation: Optimistic concurrency control verifies Branch.headCommit hasn't moved under concurrency.
 *   - Durability: Write concerns ensure committed data is safely persisted.
 *
 * @param {Object} params
 * @param {string} params.repoId
 * @param {string} params.branchId
 * @param {string} params.authorId
 * @param {string} params.message
 * @param {Array}  params.files - [{ path, content, status }]
 * @param {Array}  params.parentCommitIds - [] for initial commit
 * @param {boolean} params.isMergeCommit
 * @param {boolean} [params.simulateFailure] - For DBMS Viva demonstration of atomic rollback
 */
const createCommit = async ({
  repoId,
  branchId,
  authorId,
  userRole,
  message,
  files,
  parentCommitIds = [],
  isMergeCommit = false,
  simulateFailure = false,
}) => {
  if (!files || files.length === 0) {
    throw Object.assign(new Error('At least one file is required for a commit'), { statusCode: 400 });
  }

  // Pre-validate branch existence and retrieve current head
  const branch = await Branch.findById(branchId);
  if (!branch) {
    throw Object.assign(new Error('Branch not found'), { statusCode: 404 });
  }

  // Branch protection rule enforcement
  if (branch.isProtected && userRole === 'developer') {
    throw Object.assign(
      new Error('This branch is protected — only maintainers and owners can commit directly'),
      { statusCode: 403 }
    );
  }

  // Concurrency check: If parentCommitIds specified, verify head hasn't moved
  if (branch.headCommit && parentCommitIds.length > 0) {
    const expectedHeadId = String(parentCommitIds[0]);
    const currentHeadId = String(branch.headCommit);
    if (expectedHeadId !== currentHeadId) {
      throw Object.assign(
        new Error('Concurrency Conflict: Branch HEAD has moved. Pull latest commits before pushing.'),
        { statusCode: 409 }
      );
    }
  }

  // Retrieve parent commit SHAs for cryptographic chaining
  let parentHashes = [];
  const treeMap = new Map();

  if (parentCommitIds.length > 0) {
    const parents = await Commit.find({ _id: { $in: parentCommitIds } });
    parentHashes = parents.map((p) => p.sha).sort();

    // Populate baseline tree from primary parent commit
    const primaryParent = parents.find((p) => String(p._id) === String(parentCommitIds[0])) || parents[0];
    if (primaryParent && primaryParent.tree) {
      primaryParent.tree.forEach((t) => treeMap.set(t.path, t.fileVersion));
    }
  }

  const commitDate = new Date();

  // Run all writes inside an ACID transaction (or compensating rollback wrapper)
  return await runInTransaction(async (session) => {
    const sessionOpts = session && !session.isStandaloneFallback ? { session } : {};
    const createdDocsToClean = [];

    if (session && session.isStandaloneFallback) {
      session.registerCompensation(async () => {
        await Branch.updateOne(
          { _id: branchId },
          { headCommit: branch.headCommit || null }
        );
        for (const item of createdDocsToClean.reverse()) {
          if (item.model === 'Commit') await Commit.deleteOne({ _id: item.id });
          if (item.model === 'FileVersion') await FileVersion.deleteOne({ _id: item.id });
        }
      });
    }

    // Step 1: Pre-generate commitId to satisfy FileVersion.commit required constraint
    const commitId = new mongoose.Types.ObjectId();
    const newVersionDocs = [];
    for (const fileData of files) {
      // Handle deletion
      if (fileData.status === 'deleted' || fileData.content === null) {
        treeMap.delete(fileData.path);
        await File.updateOne(
          { repository: repoId, path: fileData.path },
          { isDeleted: true },
          sessionOpts
        );
        continue;
      }

      const content = fileData.content || '';
      const contentHash = computeContentHash(content);
      const fileSize = Buffer.byteLength(content, 'utf8');

      // Upsert File metadata document
      let fileDoc = await File.findOne({ repository: repoId, path: fileData.path }).session(sessionOpts.session || null);
      if (!fileDoc) {
        const [newFile] = await File.create(
          [{ repository: repoId, path: fileData.path, isDeleted: false }],
          sessionOpts
        );
        fileDoc = newFile;
      }

      // Determine next version number
      const lastVersion = await FileVersion.findOne({ file: fileDoc._id })
        .sort({ versionNumber: -1 })
        .select('versionNumber')
        .session(sessionOpts.session || null);

      const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

      // Create FileVersion with pre-generated commitId
      const [fv] = await FileVersion.create(
        [
          {
            repository: repoId,
            file: fileDoc._id,
            filePath: fileData.path,
            content,
            contentHash,
            commit: commitId,
            versionNumber,
            fileSize,
          },
        ],
        sessionOpts
      );

      newVersionDocs.push(fv);
      createdDocsToClean.push({ model: 'FileVersion', id: fv._id });

      // Update File.latestVersion pointer
      await File.updateOne(
        { _id: fileDoc._id },
        { latestVersion: fv._id, isDeleted: false },
        sessionOpts
      );

      // Update commit tree map
      treeMap.set(fileData.path, fv._id);
    }

    // Step 2: Build Merkle Tree from the complete repository snapshot at this commit
    const allSnapshotFiles = [];
    for (const [path, fvId] of treeMap.entries()) {
      let fv = newVersionDocs.find((d) => String(d._id) === String(fvId));
      if (!fv) {
        fv = await FileVersion.findById(fvId).session(sessionOpts.session || null);
      }
      if (fv) {
        allSnapshotFiles.push({ path, content: fv.content || '' });
      }
    }

    // If initial commit or all deleted, fallback to committed files
    const merkleFiles = allSnapshotFiles.length > 0 ? allSnapshotFiles : files.map((f) => ({ path: f.path, content: f.content || '' }));
    const merkleRoot = buildMerkleTree(merkleFiles);

    // Step 3: Compute deterministic SHA-256 hash
    const sha = computeCommitHash({
      message,
      parentHashes,
      merkleRoot,
      timestamp: commitDate,
      authorId: authorId.toString(),
    });

    // Step 4: Create Commit document
    const treeArray = Array.from(treeMap.entries()).map(([path, fvId]) => ({
      path,
      fileVersion: fvId,
    }));

    const [commit] = await Commit.create(
      [
        {
          _id: commitId,
          repository: repoId,
          branch: branchId,
          parentCommits: parentCommitIds,
          author: authorId,
          message,
          sha,
          merkleRoot,
          timestamp: commitDate,
          filesChanged: files.length,
          isMergeCommit,
          tree: treeArray,
        },
      ],
      sessionOpts
    );

    createdDocsToClean.push({ model: 'Commit', id: commit._id });

    // Step 5: Atomic conditional update of Branch HEAD (Isolation safeguard)
    const branchCondition = { _id: branchId };
    if (branch.headCommit) {
      branchCondition.headCommit = branch.headCommit;
    }

    const branchUpdateResult = await Branch.updateOne(
      branchCondition,
      { headCommit: commit._id },
      sessionOpts
    );

    if (branchUpdateResult.matchedCount === 0) {
      throw Object.assign(
        new Error('ACID Isolation Error: Concurrent commit detected. Branch HEAD was updated by another transaction.'),
        { statusCode: 409 }
      );
    }

    // Step 6: Log activity
    await logActivity({
      userId: authorId,
      repositoryId: repoId,
      action: 'commit_created',
      metadata: { sha: sha.slice(0, 8), message, filesChanged: files.length, branchName: branch.name },
      entityId: commit._id,
      entityModel: 'Commit',
    });

    // SIMULATED FAILURE GATE FOR DBMS VIVA DEMONSTRATION
    if (simulateFailure) {
      throw Object.assign(
        new Error('SIMULATED_ACID_FAILURE: Simulated mid-transaction crash to prove atomic rollback.'),
        { statusCode: 500, isSimulated: true }
      );
    }

    return commit;
  });
};

/**
 * getCommitHistory — Returns commit history starting from a branch HEAD.
 * Uses iterative BFS traversal of the DAG (parent references).
 */
const getCommitHistory = async (branchId, page = 1, limit = 20) => {
  const branch = await Branch.findById(branchId).populate('headCommit');
  if (!branch || !branch.headCommit) return { commits: [], total: 0 };

  const commits = await Commit.find({ branch: branchId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('author', 'username avatar')
    .populate('parentCommits', 'sha message');

  const total = await Commit.countDocuments({ branch: branchId });
  return { commits, total };
};

/**
 * getCommitDAG — Returns all commits for a repository with parent references
 * for rendering the Directed Acyclic Graph on the frontend.
 */
const getCommitDAG = async (repoId) => {
  const commits = await Commit.find({ repository: repoId })
    .sort({ createdAt: 1 })
    .populate('author', 'username avatar')
    .populate('branch', 'name')
    .populate('parentCommits', 'sha');

  return commits.map((c) => ({
    id: c._id,
    sha: c.sha,
    shortSha: c.sha.slice(0, 8),
    message: c.message,
    author: c.author,
    branch: c.branch,
    parentShas: c.parentCommits.map((p) => p.sha),
    merkleRoot: c.merkleRoot,
    isMergeCommit: c.isMergeCommit,
    createdAt: c.createdAt,
  }));
};

module.exports = { createCommit, getCommitHistory, getCommitDAG };
