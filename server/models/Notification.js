const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // null means broadcast to all? Or we just create individual records. Let's use individual records for read tracking. 
  // Wait, if I spam "All Users", individual records is better for "read" status.
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  type: { type: String, default: 'info' }, // info, warning, success
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
