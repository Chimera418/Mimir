/**
 * integrity.test.js — Automated Tests for Cryptographic Integrity & Merkle Trees
 * Demonstrates: Deterministic SHA-256, Merkle Tree Verification, DAG Traversal, Tamper Detection
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Repository = require('../models/Repository');
const Commit = require('../models/Commit');
const { buildMerkleTree, verifyMerkleTree, computeCommitHash } = require('../utils/merkle');
const {
  verifyCommitIntegrity,
  verifyRepositoryHistory,
  simulateTampering,
  healTamperedCommit,
} = require('../services/integrityService');

describe('Cryptographic Integrity & Merkle Tree Verification', () => {
  let repo;
  let sampleCommit;

  before(async () => {
    await connectDB();
    repo = await Repository.findOne({ name: 'mimir-core' });
    assert.ok(repo, 'mimir-core repository must exist (run seed first)');
    sampleCommit = await Commit.findOne({ repository: repo._id, message: { $regex: /Express server/i } });
    assert.ok(sampleCommit, 'Sample commit C2 must exist');
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('1. Merkle Tree calculation is deterministic and sensitive to order and content', () => {
    const filesA = [
      { path: 'a.js', content: 'console.log("hello");' },
      { path: 'b.js', content: 'const x = 42;' },
    ];
    const filesB = [
      { path: 'b.js', content: 'const x = 42;' },
      { path: 'a.js', content: 'console.log("hello");' },
    ];
    const filesModified = [
      { path: 'a.js', content: 'console.log("tampered");' },
      { path: 'b.js', content: 'const x = 42;' },
    ];

    const rootA = buildMerkleTree(filesA);
    const rootB = buildMerkleTree(filesB);
    const rootMod = buildMerkleTree(filesModified);

    assert.ok(rootA && rootA.length === 64, 'Root must be a 64-char SHA-256 hex string');
    assert.equal(rootA, rootB, 'File ordering must produce identical Merkle roots (deterministic)');
    assert.notEqual(rootA, rootMod, 'Modified content must change the Merkle root');

    const verifyCheck = verifyMerkleTree(filesA, rootA);
    assert.equal(verifyCheck.isValid, true);
  });

  it('2. Commit SHA-256 hash calculation is deterministic with canonical sorted keys', () => {
    const date = new Date('2026-09-01T09:00:00.000Z');
    const hash1 = computeCommitHash({
      message: 'Test commit',
      parentHashes: ['c1abc', 'c2def'],
      merkleRoot: 'aabbcc112233',
      timestamp: date,
      authorId: 'user123',
    });

    const hash2 = computeCommitHash({
      parentHashes: ['c2def', 'c1abc'], // Reverse order
      message: 'Test commit',
      timestamp: date,
      merkleRoot: 'aabbcc112233',
      authorId: 'user123',
    });

    assert.equal(hash1, hash2, 'Parent hashes sort must guarantee deterministic output');
    assert.equal(hash1.length, 64);
  });

  it('3. Clean repository history passes 100% cryptographic verification', async () => {
    const result = await verifyRepositoryHistory(repo._id, 'main');
    assert.equal(result.overallStatus, 'verified', 'Clean repo must be verified');
    assert.equal(result.failedCount, 0, 'No commits should fail verification');
    assert.ok(result.totalCommits >= 6, 'Main branch history should include multiple commits in DAG');
  });

  it('4. Detects database tampering of file content (MERKLE_ROOT_MISMATCH)', async () => {
    // Deliberately tamper with file content in DB for sampleCommit
    const tamperRes = await simulateTampering(repo._id, {
      commitSha: sampleCommit.sha,
      tamperType: 'file_content',
    });
    assert.equal(tamperRes.success, true, 'Tamper simulation should succeed');

    // Run verification on this specific commit
    const check = await verifyCommitIntegrity(sampleCommit._id);
    assert.equal(check.status, 'failed');
    assert.equal(check.errorType, 'MERKLE_ROOT_MISMATCH');
    assert.ok(check.details.expectedMerkleRoot);
    assert.ok(check.details.actualMerkleRoot);
    assert.notEqual(check.details.expectedMerkleRoot, check.details.actualMerkleRoot);

    // Repository history check should also report compromised
    const repoCheck = await verifyRepositoryHistory(repo._id, 'main');
    assert.equal(repoCheck.overallStatus, 'compromised');
    assert.ok(repoCheck.failedCount >= 1);

    // Heal the commit back to original state
    const healRes = await healTamperedCommit(repo._id, { commitSha: sampleCommit.sha });
    assert.equal(healRes.success, true);

    // Verification should now pass again
    const postHeal = await verifyCommitIntegrity(sampleCommit._id);
    assert.equal(postHeal.status, 'verified');
  });

  it('5. Detects database tampering of commit metadata (COMMIT_HASH_MISMATCH)', async () => {
    const tamperRes = await simulateTampering(repo._id, {
      commitSha: sampleCommit.sha,
      tamperType: 'commit_message',
    });
    assert.equal(tamperRes.success, true);

    const check = await verifyCommitIntegrity(sampleCommit._id);
    assert.equal(check.status, 'failed');
    assert.equal(check.errorType, 'COMMIT_HASH_MISMATCH');

    await healTamperedCommit(repo._id, { commitSha: sampleCommit.sha });
    const postHeal = await verifyCommitIntegrity(sampleCommit._id);
    assert.equal(postHeal.status, 'verified');
  });

  it('6. Detects invalid parent links in the commit DAG (PARENT_LINK_BROKEN)', async () => {
    const tamperRes = await simulateTampering(repo._id, {
      commitSha: sampleCommit.sha,
      tamperType: 'parent_link',
    });
    assert.equal(tamperRes.success, true);

    const check = await verifyCommitIntegrity(sampleCommit._id);
    assert.equal(check.status, 'failed');
    assert.equal(check.errorType, 'PARENT_LINK_BROKEN');

    await healTamperedCommit(repo._id, { commitSha: sampleCommit.sha });
    const postHeal = await verifyCommitIntegrity(sampleCommit._id);
    assert.equal(postHeal.status, 'verified');
  });
});
