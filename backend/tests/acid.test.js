/**
 * acid.test.js — Automated Tests for ACID Commit Operations & Concurrency Control
 * Demonstrates: Atomicity, Consistency, Isolation (OCC), Durability, Transaction Rollback
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
const { createCommit } = require('../services/commitService');

describe('ACID Commit Operations & Concurrency Control', () => {
  let repo;
  let testBranch;
  let alice;
  let bob;

  before(async () => {
    await connectDB();
    repo = await Repository.findOne({ name: 'mimir-core' });
    alice = await User.findOne({ username: 'alice' });
    bob = await User.findOne({ username: 'bob' });

    assert.ok(repo && alice && bob, 'Prerequisites must exist in database');

    // Create a dedicated branch for ACID testing so we do not mutate main
    const mainBranch = await Branch.findOne({ repository: repo._id, name: 'main' });
    testBranch = await Branch.create({
      repository: repo._id,
      name: `acid-test-${Date.now()}`,
      creator: alice._id,
      headCommit: mainBranch.headCommit,
      isProtected: false,
    });
  });

  after(async () => {
    if (testBranch) {
      await Branch.deleteOne({ _id: testBranch._id });
    }
    await mongoose.connection.close();
  });

  it('1. Atomicity & Consistency: Successful commit writes all documents and advances branch HEAD', async () => {
    const initialHead = await Commit.findById(testBranch.headCommit);
    const newFileContent = `console.log("ACID transaction test - ${Date.now()}");`;

    const commit = await createCommit({
      repoId: repo._id,
      branchId: testBranch._id,
      authorId: alice._id,
      message: 'feat: acid commit test',
      files: [
        { path: 'src/acid_test.js', content: newFileContent },
      ],
      parentCommitIds: [initialHead._id],
    });

    assert.ok(commit, 'createCommit must return commit document');
    assert.equal(commit.message, 'feat: acid commit test');
    assert.ok(commit.sha, 'Commit must have a valid SHA');
    assert.ok(commit.merkleRoot, 'Commit must have a valid Merkle root');

    // Check Branch HEAD was atomically updated to new commit
    const updatedBranch = await Branch.findById(testBranch._id);
    assert.equal(updatedBranch.headCommit.toString(), commit._id.toString(), 'Branch HEAD must point to new commit');

    // Check FileVersion was persisted
    const fv = await FileVersion.findOne({ commit: commit._id, filePath: 'src/acid_test.js' });
    assert.ok(fv, 'FileVersion must exist in database');
    assert.equal(fv.content, newFileContent);

    // Check ActivityLog was recorded
    const log = await ActivityLog.findOne({
      repository: repo._id,
      action: 'commit_created',
      entityId: commit._id,
    });
    assert.ok(log, 'Audit log entry must be created in transaction');

    // Update local reference for subsequent tests
    testBranch.headCommit = commit._id;
  });

  it('2. Atomicity & Rollback: Simulated failure rolls back all partial database writes', async () => {
    const currentBranchBefore = await Branch.findById(testBranch._id);
    const headCommitBefore = currentBranchBefore.headCommit.toString();

    const testPath = `src/rollback_${Date.now()}.js`;
    let errorThrown = false;

    try {
      await createCommit({
        repoId: repo._id,
        branchId: testBranch._id,
        authorId: alice._id,
        message: 'feat: this commit will abort mid-transaction',
        files: [
          { path: testPath, content: 'malicious or buggy state' },
        ],
        parentCommitIds: [currentBranchBefore.headCommit],
        simulateFailure: true, // Trigger deliberate rollback inside transaction
      });
    } catch (err) {
      errorThrown = true;
      assert.match(err.message, /SIMULATED_ACID_FAILURE|Simulated mid-transaction crash/i);
    }

    assert.equal(errorThrown, true, 'createCommit should throw error when simulateFailure is true');

    // Verify ATOMICITY: Branch HEAD was NOT updated
    const branchAfter = await Branch.findById(testBranch._id);
    assert.equal(branchAfter.headCommit.toString(), headCommitBefore, 'Branch HEAD must remain unchanged after aborted commit');

    // Verify ATOMICITY: No commit with that message exists
    const abortedCommit = await Commit.findOne({
      repository: repo._id,
      branch: testBranch._id,
      message: 'feat: this commit will abort mid-transaction',
    });
    assert.equal(abortedCommit, null, 'Aborted commit record must not exist in database');

    // Verify ATOMICITY: No orphan file version exists
    const orphanFv = await FileVersion.findOne({
      repository: repo._id,
      filePath: testPath,
    });
    assert.equal(orphanFv, null, 'Orphan FileVersion must not exist in database');
  });

  it('3. Isolation (OCC): Concurrent commit with stale expected parent is rejected', async () => {
    const currentBranch = await Branch.findById(testBranch._id);
    const fakeStaleId = new mongoose.Types.ObjectId(); // Stale/wrong parent

    let occErrorThrown = false;
    try {
      await createCommit({
        repoId: repo._id,
        branchId: testBranch._id,
        authorId: bob._id,
        message: 'feat: concurrent commit with stale parent',
        files: [{ path: 'README.md', content: '# Concurrency Conflict' }],
        parentCommitIds: [fakeStaleId], // Mismatch simulates another developer pushed first
      });
    } catch (err) {
      occErrorThrown = true;
      assert.ok(
        err.message.includes('Concurrency Conflict') ||
        err.statusCode === 409,
        `Expected concurrency error, got: ${err.message}`
      );
    }

    assert.equal(occErrorThrown, true, 'Stale parent commit must be rejected to prevent lost updates');

    // Branch HEAD remains unchanged
    const branchCheck = await Branch.findById(testBranch._id);
    assert.equal(branchCheck.headCommit.toString(), currentBranch.headCommit.toString());
  });

  it('4. Branch Protection: Direct commits to protected branches are blocked on backend', async () => {
    // Enable branch protection on testBranch
    await Branch.updateOne({ _id: testBranch._id }, { isProtected: true });

    let protectionErrorThrown = false;
    try {
      // Bob is a developer, direct commits to protected branch are blocked
      await createCommit({
        repoId: repo._id,
        branchId: testBranch._id,
        authorId: bob._id,
        userRole: 'developer',
        message: 'feat: unauthorized push to protected branch',
        files: [{ path: 'README.md', content: '# Hacked' }],
      });
    } catch (err) {
      protectionErrorThrown = true;
      assert.ok(
        err.message.includes('protected') || err.statusCode === 403,
        `Expected branch protection error, got: ${err.message}`
      );
    }

    assert.equal(protectionErrorThrown, true, 'Push to protected branch must fail on backend');
  });
});
