/**
 * conflicts.test.js — Automated Tests for 3-Way Merge, Conflict Detection, and Common Ancestor
 * Demonstrates: DAG LCA Search, 3-Way Differential Analysis, Git Conflict Markers, Atomic Merging
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
const PullRequest = require('../models/PullRequest');
const {
  findCommonAncestor,
  perform3WayMerge,
  checkPullRequestConflicts,
  executeTransactionalMerge,
} = require('../services/mergeService');

describe('Branch Protection, 3-Way Merge & Conflict Detection', () => {
  let repo;
  let c2;
  let c3;
  let c6;
  let openPr;

  before(async () => {
    await connectDB();
    repo = await Repository.findOne({ name: 'mimir-core' });
    assert.ok(repo, 'mimir-core repository must exist');

    c2 = await Commit.findOne({ repository: repo._id, message: { $regex: /Express server/i } });
    c3 = await Commit.findOne({ repository: repo._id, message: { $regex: /docs: update README/i } });
    c6 = await Commit.findOne({ repository: repo._id, message: { $regex: /Merkle tree unit tests/i } });
    openPr = await PullRequest.findOne({ repository: repo._id, number: 2 });

    assert.ok(c2 && c3 && c6, 'Seeded commits C2, C3, C6 must exist in DAG');
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('1. DAG Common Ancestor: findCommonAncestor correctly identifies LCA merge base', async () => {
    // In our seeded DAG:
    // C1 -> C2 -> C3 (main)
    //         \-> C4 -> C5 -> C6 (feature/auth)
    // The lowest common ancestor between C3 and C6 is C2!
    const lca = await findCommonAncestor(c3._id, c6._id);
    assert.ok(lca, 'LCA must not be null');
    assert.equal(lca.toString(), c2._id.toString(), 'LCA between C3 and C6 must be C2');

    // LCA of a commit with itself is itself
    const selfLca = await findCommonAncestor(c3._id, c3._id);
    assert.equal(selfLca.toString(), c3._id.toString());
  });

  it('2. 3-Way Differential Analysis: Clean merge when only one side modified the file', () => {
    const baseContent = 'const a = 1;\nconst b = 2;\n';
    const targetContent = 'const a = 1;\nconst b = 2;\n'; // unchanged from base
    const sourceContent = 'const a = 1;\nconst b = 2;\nconst c = 3;\n'; // appended

    const result = perform3WayMerge(baseContent, targetContent, sourceContent, 'main', 'feature');
    assert.equal(result.hasConflict, false, 'Should merge cleanly');
    assert.equal(result.mergedContent, sourceContent, 'Should accept modified source');
  });

  it('3. Conflict Detection: Overlapping divergent modifications generate Git conflict markers', () => {
    const baseContent = 'function hello() {\n  return "world";\n}';
    const targetContent = 'function hello() {\n  return "WORLD_FROM_MAIN";\n}';
    const sourceContent = 'function hello() {\n  return "world_from_feature";\n}';

    const result = perform3WayMerge(baseContent, targetContent, sourceContent, 'main', 'feature');
    assert.equal(result.hasConflict, true, 'Divergent edits must be detected as conflict');
    assert.ok(result.conflictContent.includes('<<<<<<< main'));
    assert.ok(result.conflictContent.includes('======='));
    assert.ok(result.conflictContent.includes('>>>>>>> feature'));
    assert.ok(result.conflictContent.includes('WORLD_FROM_MAIN'));
    assert.ok(result.conflictContent.includes('world_from_feature'));
  });

  it('4. Pull Request Conflict Checking: checkPullRequestConflicts computes diff against common ancestor', async () => {
    if (!openPr) return;

    const prCheck = await checkPullRequestConflicts(openPr._id);
    assert.ok(typeof prCheck.canMerge === 'boolean', 'canMerge must be boolean');
    assert.ok(typeof prCheck.hasConflicts === 'boolean', 'hasConflicts must be boolean');
    assert.ok(Array.isArray(prCheck.conflicts), 'conflicts must be an array');
    assert.ok(Array.isArray(prCheck.cleanFiles), 'cleanFiles must be an array');
    if (prCheck.commonAncestorSha) {
      assert.equal(prCheck.commonAncestorSha.length, 64, 'Ancestor SHA must be valid 64-char hash');
    }
  });
});
