/**
 * integrityService.js — Cryptographic Integrity Verification & Tamper Detection
 *
 * Demonstrates DBMS Security & Integrity Concepts:
 * - Deterministic SHA-256 Commit Hashes
 * - Merkle Tree leaf and root verification
 * - DAG parent-child continuity audit
 * - Strict read-only verification (never overwrites expected hashes)
 * - Controlled tampering simulation for live DBMS demonstrations
 */

const User = require('../models/User');
const Commit = require('../models/Commit');
const Branch = require('../models/Branch');
const FileVersion = require('../models/FileVersion');
const { buildMerkleTree, computeCommitHash } = require('../utils/merkle');
const { logActivity } = require('./activityService');

// In-memory registry of original values for demonstration rollback/healing
const tamperBackupRegistry = new Map();

/**
 * Verify a single commit's cryptographic integrity.
 * Checks:
 *   1. File contents re-hashed into Merkle Tree match stored commit.merkleRoot
 *   2. Commit message + parents + author + timestamp + merkleRoot match commit.sha
 *   3. Parent commit references exist and form valid DAG edges
 *
 * @param {string|ObjectId} commitId
 * @returns {Promise<Object>} Verification details
 */
const verifyCommitIntegrity = async (commitId) => {
  const commit = await Commit.findById(commitId)
    .populate('author', 'username avatar')
    .populate('parentCommits', 'sha message')
    .populate({
      path: 'tree.fileVersion',
      select: 'filePath content contentHash fileSize',
    });

  if (!commit) {
    return {
      status: 'failed',
      errorType: 'COMMIT_NOT_FOUND',
      message: `Commit document ${commitId} does not exist in database`,
    };
  }

  // 1. Reconstruct file list for Merkle Tree verification
  let files = [];
  if (commit.tree && commit.tree.length > 0) {
    files = commit.tree
      .filter((t) => t.fileVersion)
      .map((t) => ({
        path: t.path || t.fileVersion.filePath,
        content: t.fileVersion.content || '',
      }));
  } else {
    // Fallback: check file versions linked directly to this commit
    const directVersions = await FileVersion.find({ commit: commit._id });
    files = directVersions.map((fv) => ({
      path: fv.filePath,
      content: fv.content || '',
    }));
  }

  // Recompute Merkle root from actual file contents
  const recomputedMerkleRoot = buildMerkleTree(files);

  // Check 1: Merkle Root verification
  if (commit.merkleRoot && commit.merkleRoot !== recomputedMerkleRoot) {
    return {
      commitId: commit._id,
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 8),
      message: commit.message,
      author: commit.author?.username || 'Unknown',
      timestamp: commit.timestamp || commit.createdAt,
      status: 'failed',
      errorType: 'MERKLE_ROOT_MISMATCH',
      details: {
        expectedMerkleRoot: commit.merkleRoot,
        actualMerkleRoot: recomputedMerkleRoot,
        inspectedFilesCount: files.length,
        description: 'Stored file content in the database does not match the cryptographic Merkle tree root.',
      },
    };
  }

  // Check 2: Parent References in DAG
  const unpopulated = await Commit.findById(commitId).select('parentCommits');
  const rawParentIds = unpopulated?.parentCommits || [];
  const parentHashes = [];

  if (rawParentIds.length > 0) {
    const validPopulatedParents = (commit.parentCommits || []).filter((p) => p && p.sha);
    if (validPopulatedParents.length !== rawParentIds.length) {
      return {
        commitId: commit._id,
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 8),
        message: commit.message,
        author: commit.author?.username || 'Unknown',
        timestamp: commit.timestamp || commit.createdAt,
        status: 'failed',
        errorType: 'PARENT_LINK_BROKEN',
        details: {
          description: 'Parent commit reference points to an invalid or missing commit in the DAG.',
        },
      };
    }
    for (const parent of validPopulatedParents) {
      parentHashes.push(parent.sha);
    }
  }

  // Check 3: Deterministic Commit SHA-256 calculation
  const authorId = commit.author?._id?.toString() || (commit.author ? commit.author.toString() : '');
  const commitTimestamp = commit.timestamp || commit.createdAt;

  const recomputedSha = computeCommitHash({
    message: commit.message,
    parentHashes,
    merkleRoot: commit.merkleRoot,
    timestamp: commitTimestamp,
    authorId,
  });

  if (commit.sha !== recomputedSha) {
    return {
      commitId: commit._id,
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 8),
      message: commit.message,
      author: commit.author?.username || 'Unknown',
      timestamp: commitTimestamp,
      status: 'failed',
      errorType: 'COMMIT_HASH_MISMATCH',
      details: {
        expectedSha: commit.sha,
        actualSha: recomputedSha,
        description: 'Commit metadata (message, author, parents, or timestamp) was modified in the database.',
      },
    };
  }

  return {
    commitId: commit._id,
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 8),
    message: commit.message,
    author: commit.author?.username || 'Unknown',
    timestamp: commitTimestamp,
    merkleRoot: commit.merkleRoot,
    fileCount: files.length,
    parentCount: parentHashes.length,
    status: 'verified',
    errorType: null,
    details: {
      merkleVerified: true,
      hashVerified: true,
      parentLinksVerified: true,
    },
  };
};

/**
 * Verify complete repository commit history from a branch HEAD down to root commits.
 *
 * @param {string|ObjectId} repoId
 * @param {string} branchName
 * @param {string|ObjectId} [userId]
 */
const verifyRepositoryHistory = async (repoId, branchName, userId = null) => {
  const branch = await Branch.findOne({ repository: repoId, name: branchName });
  if (!branch) {
    throw Object.assign(new Error(`Branch '${branchName}' not found`), { statusCode: 404 });
  }

  if (!branch.headCommit) {
    return {
      repositoryId: repoId,
      branchName,
      totalCommits: 0,
      verifiedCount: 0,
      failedCount: 0,
      overallStatus: 'empty',
      results: [],
      verifiedAt: new Date(),
    };
  }

  // Traverse DAG starting from branch.headCommit using BFS
  const queue = [branch.headCommit];
  const visited = new Set();
  const commitResults = [];
  let failedCount = 0;

  while (queue.length > 0) {
    const currentId = queue.shift();
    const idStr = String(currentId);
    if (visited.has(idStr)) continue;
    visited.add(idStr);

    const check = await verifyCommitIntegrity(currentId);
    commitResults.push(check);

    if (check.status === 'failed') {
      failedCount++;
    }

    // Queue parents
    const commitDoc = await Commit.findById(currentId).select('parentCommits');
    if (commitDoc && commitDoc.parentCommits) {
      commitDoc.parentCommits.forEach((pId) => queue.push(pId));
    }
  }

  const overallStatus = failedCount === 0 ? 'verified' : 'compromised';

  // Audit logging: record verification event
  if (userId) {
    await logActivity({
      userId,
      repositoryId: repoId,
      action: 'integrity_verified',
      metadata: {
        branch: branchName,
        totalCommits: commitResults.length,
        verifiedCount: commitResults.length - failedCount,
        failedCount,
        overallStatus,
      },
    });
  }

  return {
    repositoryId: repoId,
    branchName,
    totalCommits: commitResults.length,
    verifiedCount: commitResults.length - failedCount,
    failedCount,
    overallStatus,
    results: commitResults,
    verifiedAt: new Date(),
  };
};

/**
 * Simulate database tampering on a commit or file version for DBMS Viva demonstration.
 * Modifies raw database documents without recalculating cryptographic hashes.
 */
const simulateTampering = async (repoId, { commitSha, tamperType = 'file_content' }) => {
  const commit = await Commit.findOne({ repository: repoId, sha: commitSha }).populate({
    path: 'tree.fileVersion',
  });

  if (!commit) {
    throw Object.assign(new Error('Commit not found for tampering test'), { statusCode: 404 });
  }

  const key = `${repoId}:${commitSha}`;

  if (tamperType === 'file_content') {
    // Find first fileVersion attached to this commit
    let targetFv = null;
    if (commit.tree && commit.tree.length > 0 && commit.tree[0].fileVersion) {
      targetFv = commit.tree[0].fileVersion;
    } else {
      targetFv = await FileVersion.findOne({ commit: commit._id });
    }

    if (!targetFv) {
      throw Object.assign(new Error('No file version found to tamper'), { statusCode: 400 });
    }

    // Save backup
    tamperBackupRegistry.set(key, {
      type: 'file_content',
      fileVersionId: targetFv._id,
      originalContent: targetFv.content,
    });

    // Tamper the file content directly in MongoDB without updating commit.merkleRoot!
    await FileVersion.updateOne(
      { _id: targetFv._id },
      { content: targetFv.content + '\n// [UNAUTHORIZED_DATABASE_INJECTION_TEST]' }
    );

    return {
      success: true,
      tamperType,
      commitSha,
      affectedFile: targetFv.filePath,
      message: 'Tampered file content in MongoDB. Run integrity check to observe MERKLE_ROOT_MISMATCH.',
    };
  } else if (tamperType === 'commit_message') {
    // Save backup
    tamperBackupRegistry.set(key, {
      type: 'commit_message',
      commitId: commit._id,
      originalMessage: commit.message,
    });

    // Tamper commit message without updating commit.sha!
    await Commit.updateOne(
      { _id: commit._id },
      { message: commit.message + ' [MALICIOUS_DB_MODIFICATION]' }
    );

    return {
      success: true,
      tamperType,
      commitSha,
      message: 'Tampered commit message in MongoDB. Run integrity check to observe COMMIT_HASH_MISMATCH.',
    };
  } else if (tamperType === 'parent_link') {
    // Save backup
    tamperBackupRegistry.set(key, {
      type: 'parent_link',
      commitId: commit._id,
      originalParents: commit.parentCommits,
    });

    // Replace parent with random fake ObjectId
    const fakeId = new (require('mongoose').Types.ObjectId)();
    await Commit.updateOne({ _id: commit._id }, { parentCommits: [fakeId] });

    return {
      success: true,
      tamperType,
      commitSha,
      message: 'Tampered parent link in MongoDB. Run integrity check to observe PARENT_LINK_BROKEN.',
    };
  } else {
    throw Object.assign(new Error('Invalid tamperType. Use file_content, commit_message, or parent_link'), { statusCode: 400 });
  }
};

/**
 * Restore/heal a tampered commit to its authentic state.
 */
const healTamperedCommit = async (repoId, { commitSha }) => {
  const key = `${repoId}:${commitSha}`;
  const backup = tamperBackupRegistry.get(key);

  if (!backup) {
    // Fallback: If no backup in memory, check if message has tamper suffix
    const commit = await Commit.findOne({ repository: repoId, sha: commitSha });
    if (commit && commit.message.includes(' [MALICIOUS_DB_MODIFICATION]')) {
      await Commit.updateOne(
        { _id: commit._id },
        { message: commit.message.replace(' [MALICIOUS_DB_MODIFICATION]', '') }
      );
      return { success: true, message: 'Healed commit message from pattern match.' };
    }
    throw Object.assign(new Error('No active tamper record found to heal'), { statusCode: 404 });
  }

  if (backup.type === 'file_content') {
    await FileVersion.updateOne({ _id: backup.fileVersionId }, { content: backup.originalContent });
  } else if (backup.type === 'commit_message') {
    await Commit.updateOne({ _id: backup.commitId }, { message: backup.originalMessage });
  } else if (backup.type === 'parent_link') {
    await Commit.updateOne({ _id: backup.commitId }, { parentCommits: backup.originalParents });
  }

  tamperBackupRegistry.delete(key);
  return { success: true, message: 'Commit restored to original verified state.' };
};

module.exports = {
  verifyCommitIntegrity,
  verifyRepositoryHistory,
  simulateTampering,
  healTamperedCommit,
};
