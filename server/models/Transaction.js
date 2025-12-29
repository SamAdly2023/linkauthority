const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['earn', 'spend'], required: true },
  points: { type: Number, required: true },
  sourceUrl: String,
  targetUrl: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  verificationUrl: String,
  relatedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  timestamp: { type: Date, default: Date.now }
});

mongoose.model('Transaction', TransactionSchema);
