const mongoose = require('mongoose');

/**
 * FileVersion — A snapshot of a file's content at a specific commit.
 * Stores full content + SHA-256 hash for integrity verification.
 */
const fileVersionSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    contentHash: {
      type: String,
      required: true,
    },
    commit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commit',
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    encoding: {
      type: String,
      default: 'utf-8',
    },
  },
  { timestamps: true }
);

fileVersionSchema.index({ file: 1, versionNumber: -1 });
fileVersionSchema.index({ file: 1, commit: 1 });
fileVersionSchema.index({ repository: 1, filePath: 1, createdAt: -1 });

module.exports = mongoose.model('FileVersion', fileVersionSchema);
