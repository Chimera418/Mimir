const mongoose = require('mongoose');

const releaseSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    tag: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tag',
      required: true,
    },
    commit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commit',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Release name is required'],
      maxlength: [200],
      trim: true,
    },
    body: {
      type: String,
      maxlength: [50000],
      default: '',
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
    isPrerelease: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

releaseSchema.index({ repository: 1, createdAt: -1 });
releaseSchema.index({ repository: 1, tag: 1 }, { unique: true });

module.exports = mongoose.model('Release', releaseSchema);
