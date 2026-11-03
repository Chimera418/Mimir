const mongoose = require('mongoose');

const pullRequestSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    number: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'PR title is required'],
      maxlength: [256, 'Title cannot exceed 256 characters'],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [10000, 'Description cannot exceed 10000 characters'],
      default: '',
    },
    sourceBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    targetBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'merged', 'closed'],
      default: 'open',
    },
    mergeCommit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commit',
      default: null,
    },
    mergedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    mergedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    reviewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    labels: [{ type: String }],
  },
  { timestamps: true }
);

pullRequestSchema.index({ repository: 1, number: 1 }, { unique: true });
pullRequestSchema.index({ repository: 1, status: 1 });
pullRequestSchema.index({ author: 1 });

module.exports = mongoose.model('PullRequest', pullRequestSchema);
