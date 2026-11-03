/**
 * recoveryService.js — Version Recovery & Commit Reversion
 *
 * Demonstrates DBMS Concepts:
 * - Immutable History: Reversion creates a forward-moving recovery commit rather than deleting data.
 * - Point-in-time Snapshot Restoration: Computes inverse differential changes against the commit parent.
 * - Audit Trail: Records recovery events with target and resultant SHAs.
 */

const User = require('../models/User');
const Commit = require('../models/Commit');
const Branch = require('../models/Branch');
const FileVersion = require('../models/FileVersion');
const { createCommit } = require('./commitService');
const { logActivity } = require('./activityService');

/**
 * Revert a target commit by computing its inverse changes and applying them
 * as a brand-new commit on top of the branch HEAD.
 *
 * @param {Object} params
 * @param {string} params.repoId
 * @param {string} params.branchName
 * @param {string} params.targetSha
 * @param {string} params.userId
 * @param {string} [params.reason]
 */
const revertCommit = async ({ repoId, branchName, targetSha, userId, reason = '' }) => {
  // 1. Locate the target commit to revert
  const targetCommit = await Commit.findOne({ repository: repoId, sha: targetSha }).populate({
    path: 'tree.fileVersion',
  });

  if (!targetCommit) {
    throw Object.assign(new Error(`Commit with SHA '${targetSha}' not found`), { statusCode: 404 });
  }

  // 2. Locate the branch to apply the revert on
  const branch = await Branch.findOne({ repository: repoId, name: branchName });
  if (!branch) {
    throw Object.assign(new Error(`Branch '${branchName}' not found`), { statusCode: 404 });
  }

  if (!branch.headCommit) {
    throw Object.assign(new Error(`Branch '${branchName}' has no commits to revert`), { statusCode: 400 });
  }

  // 3. Load the target commit's parent state (state BEFORE the target commit)
  const targetParentTreeMap = new Map();
  if (targetCommit.parentCommits && targetCommit.parentCommits.length > 0) {
    const parentCommit = await Commit.findById(targetCommit.parentCommits[0]).populate({
      path: 'tree.fileVersion',
    });
    if (parentCommit && parentCommit.tree) {
      for (const t of parentCommit.tree) {
        if (t.fileVersion) {
          targetParentTreeMap.set(t.path, t.fileVersion.content || '');
        }
      }
    }
  }

  // 4. Map the state AT the target commit
  const targetTreeMap = new Map();
  if (targetCommit.tree) {
    for (const t of targetCommit.tree) {
      if (t.fileVersion) {
        targetTreeMap.set(t.path, t.fileVersion.content || '');
      }
    }
  }

  // 5. Determine the inverse changes
  // All paths touched in targetCommit or targetParent
  const allAffectedPaths = new Set([...targetTreeMap.keys(), ...targetParentTreeMap.keys()]);
  const revertFiles = [];

  for (const filePath of allAffectedPaths) {
    const contentBeforeTarget = targetParentTreeMap.has(filePath) ? targetParentTreeMap.get(filePath) : null;
    const contentAtTarget = targetTreeMap.has(filePath) ? targetTreeMap.get(filePath) : null;

    if (contentBeforeTarget === null && contentAtTarget !== null) {
      // File was added in target commit -> Revert must delete it
      revertFiles.push({
        path: filePath,
        content: null,
        status: 'deleted',
      });
    } else if (contentBeforeTarget !== null && contentAtTarget === null) {
      // File was deleted in target commit -> Revert must recreate it with pre-target content
      revertFiles.push({
        path: filePath,
        content: contentBeforeTarget,
        status: 'modified',
      });
    } else if (contentBeforeTarget !== contentAtTarget) {
      // File was modified in target commit -> Revert must reset it to pre-target content
      revertFiles.push({
        path: filePath,
        content: contentBeforeTarget,
        status: 'modified',
      });
    }
  }

  if (revertFiles.length === 0) {
    throw Object.assign(new Error('Target commit introduced no file alterations to invert'), { statusCode: 400 });
  }

  // 6. Create the forward-moving Revert commit
  const commitMessage = `Revert "${targetCommit.message}"\n\nThis inverts commit ${targetCommit.sha.slice(0, 8)}.${reason ? `\nReason: ${reason}` : ''}`;

  const revertCommitDoc = await createCommit({
    repoId,
    branchId: branch._id,
    authorId: userId,
    message: commitMessage,
    files: revertFiles,
    parentCommitIds: [branch.headCommit],
  });

  // 7. Log version recovery audit action
  await logActivity({
    userId,
    repositoryId: repoId,
    action: 'commit_reverted',
    metadata: {
      targetSha: targetCommit.sha,
      targetShortSha: targetCommit.sha.slice(0, 8),
      revertSha: revertCommitDoc.sha,
      revertShortSha: revertCommitDoc.sha.slice(0, 8),
      branchName: branch.name,
      filesReverted: revertFiles.length,
    },
    entityId: revertCommitDoc._id,
    entityModel: 'Commit',
  });

  return {
    success: true,
    targetCommit: {
      sha: targetCommit.sha,
      message: targetCommit.message,
    },
    revertCommit: {
      id: revertCommitDoc._id,
      sha: revertCommitDoc.sha,
      message: revertCommitDoc.message,
    },
    revertedFilesCount: revertFiles.length,
  };
};

module.exports = {
  revertCommit,
};
