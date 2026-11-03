const mongoose = require('mongoose');
const commitAnnotationSchema = new mongoose.Schema({
  repository: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
  commit: { type: mongoose.Schema.Types.ObjectId, ref: 'Commit', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  filePath: { type: String, default: null }, // optional – pin to a specific file in the commit
}, { timestamps: true });
commitAnnotationSchema.index({ repository: 1, commit: 1, createdAt: 1 });
module.exports = mongoose.model('CommitAnnotation', commitAnnotationSchema);
