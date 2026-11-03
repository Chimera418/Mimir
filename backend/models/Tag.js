const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      trim: true,
      match: [/^[a-zA-Z0-9_.\-/]+$/, 'Invalid tag name'],
    },
    commit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commit',
      required: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      maxlength: [1000, 'Tag message cannot exceed 1000 characters'],
      default: '',
    },
    isAnnotated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique tag name per repository
tagSchema.index({ repository: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Tag', tagSchema);
