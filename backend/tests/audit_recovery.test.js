/**
 * audit_recovery.test.js — Automated Tests for Audit Logging & Version Recovery
 * Demonstrates: Immutable Audit Trail, Pagination/Filtering/Sorting, Safe DAG Reversion
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Repository = require('../models/Repository');
const Branch = require('../models/Branch');
const Commit = require('../models/Commit');
const FileVersion = require('../models/FileVersion');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { revertCommit } = require('../services/recoveryService');

describe('Audit Logging & Version Recovery', () => {
  let repo;
  let alice;
  let testBranch;
  let commitToRevert;

  before(async () => {
    await connectDB();
    repo = await Repository.findOne({ name: 'mimir-core' });
    alice = await User.findOne({ username: 'alice' });

    assert.ok(repo && alice, 'Prerequisites must exist in database');

    // Find commit C3 (which updated README.md to v2)
    commitToRevert = await Commit.findOne({
      repository: repo._id,
      message: { $regex: /update README/i },
    });
    assert.ok(commitToRevert, 'Commit C3 must exist in database');

    // Create an isolated branch off C3's branch for revert testing
    const mainBranch = await Branch.findOne({ repository: repo._id, name: 'main' });
    testBranch = await Branch.create({
      repository: repo._id,
      name: `recovery-test-${Date.now()}`,
      creator: alice._id,
      headCommit: commitToRevert._id,
      isProtected: false,
    });
  });

  after(async () => {
    if (testBranch) {
      await Branch.deleteOne({ _id: testBranch._id });
    }
    await mongoose.connection.close();
  });

  it('1. Audit trail records repository operations with pagination, action filtering, and sorting', async () => {
    // Check total logs for mimir-core
    const allLogs = await ActivityLog.find({ repository: repo._id }).sort({ createdAt: -1 });
    assert.ok(allLogs.length >= 5, 'Repository should have seeded activity logs');

    // Filter by action: commit_created
    const commitLogs = await ActivityLog.find({
      repository: repo._id,
      action: 'commit_created',
    }).sort({ createdAt: -1 });

    assert.ok(commitLogs.length > 0, 'Must contain commit_created logs');
    assert.ok(commitLogs.every((l) => l.action === 'commit_created'));

    // Pagination test (page 1, limit 3)
    const paginated = await ActivityLog.find({ repository: repo._id })
      .sort({ createdAt: -1 })
      .limit(3);
    assert.equal(paginated.length, 3, 'Should respect limit of 3');

    // Sorting test: first element should be newer than last element
    if (allLogs.length >= 2) {
      assert.ok(
        new Date(allLogs[0].createdAt).getTime() >= new Date(allLogs[allLogs.length - 1].createdAt).getTime(),
        'Logs must be ordered chronologically'
      );
    }
  });

  it('2. Version Recovery: Reverts target commit without rewriting or deleting history', async () => {
    const headBefore = await Commit.findById(testBranch.headCommit);

    const result = await revertCommit({
      repoId: repo._id,
      branchName: testBranch.name,
      targetSha: commitToRevert.sha,
      userId: alice._id,
      reason: 'Reverting README changes for testing',
    });

    assert.equal(result.success, true);
    assert.ok(result.revertCommit.sha, 'Revert commit must have a SHA');
    assert.ok(result.revertCommit.message.includes('Revert "docs: update README with Getting Started guide"'));

    // 1. Check branch HEAD was updated to the new revert commit
    const updatedBranch = await Branch.findById(testBranch._id);
    assert.equal(updatedBranch.headCommit.toString(), result.revertCommit.id.toString());

    // 2. Check IMMUTABILITY: Original target commit C3 STILL exists in MongoDB intact
    const originalCommitStillExists = await Commit.findById(commitToRevert._id);
    assert.ok(originalCommitStillExists, 'Original commit must NOT be deleted');
    assert.equal(originalCommitStillExists.sha, commitToRevert.sha);

    // 3. Check DAG edge: Revert commit has previous HEAD as its parent
    const revertCommitDoc = await Commit.findById(result.revertCommit.id);
    assert.equal(revertCommitDoc.parentCommits[0].toString(), headBefore._id.toString());

    // 4. Check Audit Trail: Activity log recorded commit_reverted
    const auditEntry = await ActivityLog.findOne({
      repository: repo._id,
      action: 'commit_reverted',
      entityId: revertCommitDoc._id,
    });
    assert.ok(auditEntry, 'Audit log entry must be created for commit_reverted');
    assert.equal(auditEntry.metadata.targetSha, commitToRevert.sha);
  });

  it('3. Error Handling: Reverting nonexistent commit fails safely with 404', async () => {
    let errorThrown = false;
    try {
      await revertCommit({
        repoId: repo._id,
        branchName: testBranch.name,
        targetSha: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        userId: alice._id,
      });
    } catch (err) {
      errorThrown = true;
      assert.equal(err.statusCode, 404);
    }
    assert.equal(errorThrown, true);
  });
});
