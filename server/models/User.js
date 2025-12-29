const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  googleId: { type: String, unique: true },
  name: { type: String },
  email: { type: String },
  phone: { type: String },
  avatar: { type: String },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, default: 5.0 },
  reviewCount: { type: Number, default: 0 },
  points: { type: Number, default: 100 },
  websites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Website' }],
  transactions: [{
    type: { type: String, enum: ['earn', 'spend'] },
    points: Number,
    timestamp: { type: Date, default: Date.now },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
});

module.exports = mongoose.model('User', UserSchema);