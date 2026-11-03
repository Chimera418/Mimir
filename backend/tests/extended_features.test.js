/**
 * extended_features.test.js — Automated Tests for Advanced Mímir Features:
 * 1. Global Cross-Branch File History (Queryable Document Store)
 * 2. Commit Annotations & Standalone Review (PR-independent discussions)
 * 3. Branch Lifecycle & Age Distribution
 * 4. Merge Conflict Frequency & Hotspot File Analysis
 * 5. Contributor Code Ownership Heatmap via MongoDB Aggregation Pipelines
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Repository = require('../models/Repository');
const Branch = require('../models/Branch');
const Commit = require('../models/Commit');
const FileVersion = require('../models/FileVersion');
const User = require('../models/User');
const CommitAnnotation = require('../models/CommitAnnotation');

describe('Extended VCS Capabilities (DBMS Advantages over Git/GitHub)', () => {
  let repo;
  let alice;
  let sampleCommit;

  before(async () => {
    await connectDB();
    repo = await Repository.findOne({ name: 'mimir-core' });
    alice = await User.findOne({ username: 'alice' });
    sampleCommit = await Commit.findOne({ repository: repo._id }).sort({ createdAt: -1 });

    assert.ok(repo, 'Repository mimir-core must exist');
    assert.ok(alice, 'User alice must exist');
    assert.ok(sampleCommit, 'At least one commit must exist in repo');
  });

  after(async () => {
    await mongoose.connection.close();
  });

  describe('1. Commit Annotations & Standalone Discussion', () => {
    it('Creates an annotation attached directly to a commit SHA outside of PRs', async () => {
      const annotation = await CommitAnnotation.create({
        repository: repo._id,
        commit: sampleCommit._id,
        author: alice._id,
        body: 'Post-merge architecture observation: verify O(1) Merkle caching.',
        filePath: 'src/index.js',
      });

      assert.ok(annotation._id);
      assert.equal(annotation.filePath, 'src/index.js');
      assert.equal(annotation.body, 'Post-merge architecture observation: verify O(1) Merkle caching.');

      // Query it back
      const found = await CommitAnnotation.find({ commit: sampleCommit._id });
      assert.ok(found.length >= 1);
    });

    it('Rejects annotation creation if body is empty or missing', async () => {
      await assert.rejects(
        async () => {
          await CommitAnnotation.create({
            repository: repo._id,
            commit: sampleCommit._id,
            author: alice._id,
            body: '',
          });
        },
        { name: 'ValidationError' }
      );
    });
  });

  describe('2. Global File Evolution Across All Branches', () => {
    it('Queries full mutation timeline for a file across branches using FileVersion index', async () => {
      const versions = await FileVersion.find({ repository: repo._id })
        .populate({
          path: 'commit',
          select: 'sha branch',
          populate: { path: 'branch', select: 'name' }
        })
        .limit(20);

      assert.ok(Array.isArray(versions));
      assert.ok(versions.length > 0, 'Should find file versions in the database');
      assert.ok(versions[0].contentHash, 'Every file version must have SHA-256 content hash');
      assert.ok(versions[0].versionNumber >= 1, 'Version number must be monotonically incremented');
    });
  });

  describe('3. Branch Lifecycle & Age Analytics', () => {
    it('Computes branch age in days and protection status via single query', async () => {
      const branches = await Branch.find({ repository: repo._id }).populate('creator', 'username');
      assert.ok(branches.length >= 1);

      const now = Date.now();
      const lifecycleData = branches.map((b) => ({
        name: b.name,
        isDefault: b.isDefault,
        isProtected: b.isProtected,
        ageDays: Math.floor((now - new Date(b.createdAt).getTime()) / 86400000),
      }));

      assert.ok(lifecycleData.some((b) => b.name === 'main' || b.isDefault === true));
      assert.ok(typeof lifecycleData[0].ageDays === 'number');
    });
  });

  describe('4. Contributor Code Ownership & Churn Aggregation Pipeline', () => {
    it('Executes multi-stage aggregation pipeline to compute file authorship distribution', async () => {
      const data = await FileVersion.aggregate([
        { $match: { repository: repo._id } },
        { $lookup: { from: 'commits', localField: 'commit', foreignField: '_id', as: 'commitDoc' } },
        { $unwind: '$commitDoc' },
        { $lookup: { from: 'users', localField: 'commitDoc.author', foreignField: '_id', as: 'authorDoc' } },
        { $unwind: '$authorDoc' },
        { $group: { _id: { file: '$filePath', author: '$authorDoc.username' }, edits: { $sum: 1 } } },
        { $sort: { edits: -1 } },
        { $limit: 10 },
      ]);

      assert.ok(Array.isArray(data));
      if (data.length > 0) {
        assert.ok(data[0]._id.file);
        assert.ok(data[0]._id.author);
        assert.ok(data[0].edits >= 1);
      }
    });
  });
});
