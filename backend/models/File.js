const mongoose = require('mongoose');

// File metadata — tracks a file's existence across the repo
const fileSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    path: {
      type: String,
      required: [true, 'File path is required'],
      trim: true,
    },
    latestVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FileVersion',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound unique: one document per file path per repo
fileSchema.index({ repository: 1, path: 1 }, { unique: true });
fileSchema.index({ path: 'text' }); // for search

module.exports = mongoose.model('File', fileSchema);
