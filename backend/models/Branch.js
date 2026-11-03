const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
      match: [/^[a-zA-Z0-9_./\-]+$/, 'Invalid branch name'],
    },
    headCommit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commit',
      default: null,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isProtected: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique branch name per repository
branchSchema.index({ repository: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Branch', branchSchema);
