const mongoose = require('mongoose');

const WebsiteSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  domainAuthority: { type: Number, default: 0 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category: String,
  isVerified: { type: Boolean, default: false },
  lastChecked: Date
});

module.exports = mongoose.model('Website', WebsiteSchema);