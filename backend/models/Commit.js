const mongoose = require('mongoose');

/**
 * Commit — Core DAG node of the VCS.
 * Stores SHA-256 hash, Merkle root, and parent references forming a DAG.
 * Ported from commit.py — hash computation lives in utils/merkle.js.
 */
const commitSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    // DAG: array of parent commit ObjectIds (1 for normal, 2 for merge commits)
    parentCommits: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Commit',
      },
    ],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: [true, 'Commit message is required'],
      maxlength: [2000, 'Commit message cannot exceed 2000 characters'],
      trim: true,
    },
    // Explicit timestamp for cryptographic verification
    timestamp: {
      type: Date,
      default: Date.now,
    },
    // SHA-256 hash: deterministic from parents + merkleRoot + message + author + timestamp
    sha: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Merkle root of all files at this commit
    merkleRoot: {
      type: String,
      required: true,
    },
    // Number of files changed in this commit
    filesChanged: {
      type: Number,
      default: 0,
    },
    // For merge commits
    isMergeCommit: {
      type: Boolean,
      default: false,
    },
    // The full state of the repository at this commit
    tree: [
      {
        path: String,
        fileVersion: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'FileVersion',
        }
      }
    ]
  },
  { timestamps: true }
);

// Efficient history traversal queries
commitSchema.index({ repository: 1, branch: 1, createdAt: -1 });
commitSchema.index({ author: 1, createdAt: -1 });
commitSchema.index({ message: 'text' }); // for search

module.exports = mongoose.model('Commit', commitSchema);
