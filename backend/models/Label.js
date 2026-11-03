const mongoose = require('mongoose');

const labelSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Label name is required'],
      trim: true,
      maxlength: [50],
    },
    color: {
      type: String,
      required: true,
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'],
      default: '#0075ca',
    },
    description: {
      type: String,
      maxlength: [200],
      default: '',
    },
  },
  { timestamps: true }
);

labelSchema.index({ repository: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Label', labelSchema);
