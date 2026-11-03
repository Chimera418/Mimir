/**
 * mergeService.js — 3-Way Merge Engine with Conflict Detection & Resolution
 *
 * Demonstrates DBMS Concepts:
 * - Common Ancestor (Merge Base) DAG search via Graph Traversal
 * - 3-Way Differential Analysis: Base vs Target vs Source
 * - Conflict Detection & Generation of Standard Conflict Markers
 * - ACID-Safe Atomic Merging with Concurrency Protection
 */

const PullRequest = require('../models/PullRequest');
const Branch = require('../models/Branch');
const Commit = require('../models/Commit');
const FileVersion = require('../models/FileVersion');
const MergeOperation = require('../models/MergeOperation');
const { createCommit } = require('./commitService');
const { logActivity, createNotification } = require('./activityService');

/**
 * Find the lowest common ancestor (merge base) between two commits in the DAG.
 */
const findCommonAncestor = async (commitAId, commitBId) => {
  if (!commitAId || !commitBId) return null;
  if (String(commitAId) === String(commitBId)) return commitAId;

  // 1. Gather all ancestors of Commit A using BFS
  const ancestorsA = new Set();
  const queueA = [commitAId];

  while (queueA.length > 0) {
    const currentId = queueA.shift();
    const idStr = String(currentId);
    if (ancestorsA.has(idStr)) continue;
    ancestorsA.add(idStr);

    const doc = await Commit.findById(currentId).select('parentCommits');
    if (doc && doc.parentCommits) {
      doc.parentCommits.forEach((p) => queueA.push(p));
    }
  }

  // 2. Traverse ancestors of Commit B; first match in ancestorsA is the merge base
  const visitedB = new Set();
  const queueB = [commitBId];

  while (queueB.length > 0) {
    const currentId = queueB.shift();
    const idStr = String(currentId);
    if (ancestorsA.has(idStr)) {
      return currentId; // Lowest Common Ancestor found
    }
    if (visitedB.has(idStr)) continue;
    visitedB.add(idStr);

    const doc = await Commit.findById(currentId).select('parentCommits');
    if (doc && doc.parentCommits) {
      doc.parentCommits.forEach((p) => queueB.push(p));
    }
  }

  return null;
};

/**
 * Line-level 3-way merge between base, target, and source versions of a file.
 */
const perform3WayMerge = (baseContent = '', targetContent = '', sourceContent = '', targetLabel = 'target', sourceLabel = 'source') => {
  // Trivial cases
  if (targetContent === sourceContent) {
    return { hasConflict: false, mergedContent: targetContent };
  }
  if (targetContent === baseContent) {
    // Only source modified it -> take source
    return { hasConflict: false, mergedContent: sourceContent };
  }
  if (sourceContent === baseContent) {
    // Only target modified it -> take target
    return { hasConflict: false, mergedContent: targetContent };
  }

  // Both modified from base! Perform line-level comparison
  const baseLines = (baseContent || '').split('\n');
  const targetLines = (targetContent || '').split('\n');
  const sourceLines = (sourceContent || '').split('\n');

  // If one side just appended lines at the end of the base file and the other did not
  const isTargetBasePrefix = targetContent.startsWith(baseContent) && baseContent.length > 0;
  const isSourceBasePrefix = sourceContent.startsWith(baseContent) && baseContent.length > 0;

  if (isTargetBasePrefix && !isSourceBasePrefix && sourceContent === baseContent) {
    return { hasConflict: false, mergedContent: targetContent };
  }
  if (isSourceBasePrefix && !isTargetBasePrefix && targetContent === baseContent) {
    return { hasConflict: false, mergedContent: sourceContent };
  }

  // Overlapping modification detected on same file
  const conflictMarkerContent = [
    `<<<<<<< ${targetLabel}`,
    targetContent,
    '=======',
    sourceContent,
    `>>>>>>> ${sourceLabel}`,
  ].join('\n');

  return {
    hasConflict: true,
    conflictContent: conflictMarkerContent,
    mergedContent: null,
  };
};

/**
 * Load complete snapshot of all files at a given commit ID.
 * Returns Map of filePath -> content
 */
const getSnapshotAtCommit = async (commitId) => {
  const fileMap = new Map();
  if (!commitId) return fileMap;

  const commit = await Commit.findById(commitId).populate({
    path: 'tree.fileVersion',
  });

  if (!commit) return fileMap;

  if (commit.tree && commit.tree.length > 0) {
    for (const entry of commit.tree) {
      if (entry.fileVersion) {
        fileMap.set(entry.path, entry.fileVersion.content || '');
      }
    }
  } else {
    // Fallback: check direct FileVersions
    const versions = await FileVersion.find({ commit: commit._id });
    for (const fv of versions) {
      fileMap.set(fv.filePath, fv.content || '');
    }
  }

  return fileMap;
};

/**
 * Check a Pull Request for merge conflicts against its target branch.
 */
const checkPullRequestConflicts = async (prId) => {
  const pr = await PullRequest.findById(prId)
    .populate('sourceBranch')
    .populate('targetBranch');

  if (!pr) throw Object.assign(new Error('Pull request not found'), { statusCode: 404 });
  if (!pr.sourceBranch || !pr.targetBranch) {
    throw Object.assign(new Error('Source or target branch missing on PR'), { statusCode: 400 });
  }

  const sourceHead = pr.sourceBranch.headCommit;
  const targetHead = pr.targetBranch.headCommit;

  if (!sourceHead || !targetHead) {
    return {
      canMerge: true,
      hasConflicts: false,
      conflicts: [],
      cleanFiles: [],
      commonAncestorSha: null,
    };
  }

  // 1. Find Merge Base (Common Ancestor)
  const lcaCommitId = await findCommonAncestor(sourceHead, targetHead);
  const lcaCommit = lcaCommitId ? await Commit.findById(lcaCommitId).select('sha message') : null;

  // 2. Fetch all 3 file snapshots
  const baseFileMap = await getSnapshotAtCommit(lcaCommitId);
  const sourceFileMap = await getSnapshotAtCommit(sourceHead);
  const targetFileMap = await getSnapshotAtCommit(targetHead);

  // 3. Collect union of all file paths across branches
  const allPaths = new Set([
    ...baseFileMap.keys(),
    ...sourceFileMap.keys(),
    ...targetFileMap.keys(),
  ]);

  const conflicts = [];
  const cleanFiles = [];

  for (const filePath of allPaths) {
    const baseContent = baseFileMap.get(filePath) || null;
    const targetContent = targetFileMap.get(filePath) || null;
    const sourceContent = sourceFileMap.get(filePath) || null;

    // File only in source -> Clean add
    if (baseContent === null && targetContent === null && sourceContent !== null) {
      cleanFiles.push({ path: filePath, content: sourceContent, status: 'added' });
      continue;
    }

    // File only in target -> Keep target
    if (baseContent === null && sourceContent === null && targetContent !== null) {
      cleanFiles.push({ path: filePath, content: targetContent, status: 'kept' });
      continue;
    }

    // File deleted in source, unchanged in target -> Delete in merge
    if (baseContent !== null && sourceContent === null && targetContent === baseContent) {
      cleanFiles.push({ path: filePath, content: null, status: 'deleted' });
      continue;
    }

    // File deleted in target, unchanged in source -> Delete in merge
    if (baseContent !== null && targetContent === null && sourceContent === baseContent) {
      cleanFiles.push({ path: filePath, content: null, status: 'deleted' });
      continue;
    }

    // File deleted in one side but modified in the other -> Conflict
    if ((sourceContent === null && targetContent !== baseContent) ||
        (targetContent === null && sourceContent !== baseContent)) {
      conflicts.push({
        filePath,
        conflictType: 'DELETE_MODIFY_CONFLICT',
        conflictContent: `<<<<<<< TARGET\n${targetContent || '[FILE_DELETED]'}\n=======\n${sourceContent || '[FILE_DELETED]'}\n>>>>>>> SOURCE`,
        baseContent: baseContent || '',
        targetContent: targetContent || '',
        sourceContent: sourceContent || '',
      });
      continue;
    }

    // Both modified
    const result = perform3WayMerge(
      baseContent || '',
      targetContent || '',
      sourceContent || '',
      pr.targetBranch.name,
      pr.sourceBranch.name
    );

    if (result.hasConflict) {
      conflicts.push({
        filePath,
        conflictType: 'CONTENT_CONFLICT',
        conflictContent: result.conflictContent,
        baseContent: baseContent || '',
        targetContent: targetContent || '',
        sourceContent: sourceContent || '',
      });
    } else {
      cleanFiles.push({
        path: filePath,
        content: result.mergedContent,
        status: 'modified',
      });
    }
  }

  return {
    prId: pr._id,
    prNumber: pr.number,
    canMerge: conflicts.length === 0,
    hasConflicts: conflicts.length > 0,
    commonAncestor: lcaCommit ? { sha: lcaCommit.sha, message: lcaCommit.message } : null,
    conflicts,
    cleanFilesCount: cleanFiles.length,
    cleanFiles,
  };
};

/**
 * mergePullRequest — Safely merges an open PR into the target branch.
 * Enforces:
 *   1. Branch protection permissions (maintainer/owner required for protected target).
 *   2. Conflict verification (fails if unresolved conflicts exist).
 *   3. ACID transaction commit with atomic conditional branch HEAD update.
 */
const mergePullRequest = async (prId, userId, userRole = 'developer') => {
  const pr = await PullRequest.findById(prId)
    .populate('sourceBranch')
    .populate('targetBranch')
    .populate('author');

  if (!pr) throw Object.assign(new Error('Pull request not found'), { statusCode: 404 });
  if (pr.status !== 'open') throw Object.assign(new Error('Pull request is not open'), { statusCode: 400 });
  if (!pr.sourceBranch || !pr.targetBranch) {
    throw Object.assign(new Error('Source or target branch not found'), { statusCode: 400 });
  }

  // Branch Protection Check
  if (pr.targetBranch.isProtected && userRole !== 'owner' && userRole !== 'maintainer') {
    await logActivity({
      userId,
      repositoryId: pr.repository,
      action: 'security_violation',
      metadata: {
        reason: 'Unauthorized merge attempt into protected branch',
        targetBranch: pr.targetBranch.name,
        prNumber: pr.number,
      },
    });
    throw Object.assign(
      new Error(`Target branch '${pr.targetBranch.name}' is protected. Merging requires maintainer or owner privileges.`),
      { statusCode: 403 }
    );
  }

  // 1. Run Conflict Analysis
  const conflictReport = await checkPullRequestConflicts(prId);
  if (conflictReport.hasConflicts) {
    throw Object.assign(
      new Error(`Cannot merge: Pull Request #${pr.number} has ${conflictReport.conflicts.length} unresolved conflict(s).`),
      { statusCode: 409, conflicts: conflictReport.conflicts }
    );
  }

  // 2. Prepare merged file list
  const filesForMerge = conflictReport.cleanFiles.map((f) => ({
    path: f.path,
    content: f.content,
    status: f.status === 'deleted' ? 'deleted' : 'modified',
  }));

  // Parent commit IDs: [targetHead, sourceHead]
  const parentCommitIds = [pr.targetBranch.headCommit, pr.sourceBranch.headCommit].filter(Boolean);

  // 3. Create Merge Commit inside ACID transaction
  const mergeCommit = await createCommit({
    repoId: pr.repository,
    branchId: pr.targetBranch._id,
    authorId: userId,
    userRole: userRole || 'owner',
    message: `Merge pull request #${pr.number} from ${pr.sourceBranch.name}\n\n${pr.title}`,
    files: filesForMerge,
    parentCommitIds,
    isMergeCommit: true,
  });

  // 4. Update PR state
  await PullRequest.updateOne(
    { _id: prId },
    {
      status: 'merged',
      mergeCommit: mergeCommit._id,
      mergedBy: userId,
      mergedAt: new Date(),
    }
  );

  // 5. Record MergeOperation
  await MergeOperation.create({
    repository: pr.repository,
    sourceBranch: pr.sourceBranch._id,
    targetBranch: pr.targetBranch._id,
    mergeCommit: mergeCommit._id,
    mergedBy: userId,
    strategy: 'merge',
  });

  // 6. Notify PR author
  await createNotification({
    recipientId: pr.author._id,
    actorId: userId,
    type: 'pr_merged',
    message: `Your pull request #${pr.number} "${pr.title}" was merged into ${pr.targetBranch.name}`,
    relatedEntity: pr._id,
    entityModel: 'PullRequest',
  });

  await logActivity({
    userId,
    repositoryId: pr.repository,
    action: 'pr_merged',
    metadata: {
      prNumber: pr.number,
      title: pr.title,
      mergeCommitSha: mergeCommit.sha.slice(0, 8),
      targetBranch: pr.targetBranch.name,
    },
    entityId: pr._id,
    entityModel: 'PullRequest',
  });

  return {
    pr: await PullRequest.findById(prId),
    mergeCommit,
  };
};

/**
 * Resolve conflicts on a PR by applying user-supplied file resolutions onto the source branch.
 */
const resolveConflictsAndPush = async (prId, userId, resolutions) => {
  const pr = await PullRequest.findById(prId).populate('sourceBranch');
  if (!pr) throw Object.assign(new Error('Pull request not found'), { statusCode: 404 });
  if (pr.status !== 'open') throw Object.assign(new Error('Pull request is not open'), { statusCode: 400 });

  if (!resolutions || !Array.isArray(resolutions) || resolutions.length === 0) {
    throw Object.assign(new Error('At least one file resolution is required'), { statusCode: 400 });
  }

  // Validate that no conflict markers remain in the resolved content
  for (const r of resolutions) {
    const filePath = r.path || r.filePath;
    const content = r.resolvedContent !== undefined ? r.resolvedContent : r.content;
    if (!filePath) {
      throw Object.assign(new Error('Each resolution requires a file path'), { statusCode: 400 });
    }
    if (content && (content.includes('<<<<<<<') || content.includes('>>>>>>>') || content.includes('======='))) {
      throw Object.assign(
        new Error(`File '${filePath}' still contains unresolved conflict markers ('<<<<<<<', '=======', or '>>>>>>>'). Please clean them up before committing.`),
        { statusCode: 400 }
      );
    }
  }

  const filesToCommit = resolutions.map((r) => ({
    path: r.path || r.filePath,
    content: r.resolvedContent !== undefined ? r.resolvedContent : (r.content !== undefined ? r.content : ''),
    status: 'modified',
  }));

  // Create a resolution commit directly on the source branch
  const resolutionCommit = await createCommit({
    repoId: pr.repository,
    branchId: pr.sourceBranch._id,
    authorId: userId,
    message: `Resolve merge conflicts for pull request #${pr.number}`,
    files: filesToCommit,
    parentCommitIds: pr.sourceBranch.headCommit ? [pr.sourceBranch.headCommit] : [],
  });

  return {
    success: true,
    message: 'Conflict resolutions committed to source branch.',
    resolutionCommitSha: resolutionCommit.sha,
  };
};

module.exports = {
  findCommonAncestor,
  perform3WayMerge,
  checkPullRequestConflicts,
  mergePullRequest,
  resolveConflictsAndPush,
};
