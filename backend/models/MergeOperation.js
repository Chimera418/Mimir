const mongoose = require('mongoose');

const mergeOperationSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
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
    mergeCommit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commit',
      required: true,
    },
    mergedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    strategy: {
      type: String,
      enum: ['merge', 'squash', 'rebase'],
      default: 'merge',
    },
  },
  { timestamps: true }
);

mergeOperationSchema.index({ repository: 1, createdAt: -1 });

module.exports = mongoose.model('MergeOperation', mergeOperationSchema);
