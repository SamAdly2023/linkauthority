const mongoose = require('mongoose');

const WebsiteSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  domainAuthority: { type: Number, default: 0 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category: String,
  description: { type: String, maxlength: 200 }, // Short bio for contextual backlinks
  serviceType: { type: String, enum: ['local', 'worldwide'], default: 'worldwide' },
  location: {
    country: String,
    state: String,
    city: String
  },
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  verificationMethod: { type: String, enum: ['file', 'dns', 'admin', 'script'] },
  verificationDate: Date,
  lastChecked: Date,
  widgetActive: { type: Boolean, default: false } // For instant backlinks
});

module.exports = mongoose.model('Website', WebsiteSchema);