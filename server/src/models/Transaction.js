import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    note: { type: String, default: '', trim: true, maxlength: 200 },
    recurringRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRule', default: null },
    occurrenceDate: { type: Date, default: null },
    importBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', default: null },
    fingerprint: { type: String, required: true },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 });
transactionSchema.index(
  { userId: 1, importBatchId: 1 },
  { partialFilterExpression: { importBatchId: { $type: 'objectId' } } }
);
transactionSchema.index({ userId: 1, fingerprint: 1 });
transactionSchema.index(
  { recurringRuleId: 1, occurrenceDate: 1 },
  { unique: true, partialFilterExpression: { recurringRuleId: { $type: 'objectId' } } }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);