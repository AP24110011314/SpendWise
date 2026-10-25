import mongoose from 'mongoose';

const importBatchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    totalRows: { type: Number, required: true, min: 0 },
    importedCount: { type: Number, default: 0, min: 0 },
    skippedDuplicates: { type: Number, default: 0, min: 0 },
    invalidCount: { type: Number, default: 0, min: 0 },
    errors: [{
      row: { type: Number, required: true },
      reason: { type: String, required: true }
    }],
  },
  { timestamps: true }
);

importBatchSchema.index({ userId: 1, createdAt: -1 });

export const ImportBatch = mongoose.model('ImportBatch', importBatchSchema);