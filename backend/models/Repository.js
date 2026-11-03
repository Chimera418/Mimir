const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Repository name is required'],
      trim: true,
      minlength: [1, 'Name must be at least 1 character'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
      match: [/^[a-zA-Z0-9_.-]+$/, 'Name can only contain letters, numbers, hyphens, underscores, dots'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    defaultBranch: {
      type: String,
      default: 'main',
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    stars: {
      type: Number,
      default: 0,
      min: 0,
    },
    forks: {
      type: Number,
      default: 0,
      min: 0,
    },
    language: {
      type: String,
      default: '',
    },
    topics: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

// Compound unique: owner+name (same user can't have two repos with same name)
repositorySchema.index({ owner: 1, name: 1 }, { unique: true });
repositorySchema.index({ visibility: 1, createdAt: -1 });
repositorySchema.index({ name: 'text', description: 'text' }, { language_override: 'textSearchLanguage' }); // for search

module.exports = mongoose.model('Repository', repositorySchema);
