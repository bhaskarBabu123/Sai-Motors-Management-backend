const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  occupation: {
    type: String,
    trim: true
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  totalBikesBought: {
    type: Number,
    default: 0,
    min: 0
  },
  lastPurchaseDate: {
    type: Date
  },
  customerType: {
    type: String,
    enum: ['Regular', 'Premium', 'VIP'],
    default: 'Regular'
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Update customer type based on total spent
customerSchema.pre('save', function(next) {
  if (this.totalSpent >= 500000) {
    this.customerType = 'VIP';
  } else if (this.totalSpent >= 200000) {
    this.customerType = 'Premium';
  } else {
    this.customerType = 'Regular';
  }
  next();
});

// Indexes
customerSchema.index({ phone: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ name: 1 });

module.exports = mongoose.model('Customer', customerSchema);