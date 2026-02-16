const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    enum: ['Bike Sales', 'Service', 'Parts', 'Accessories', 'Insurance Commission', 'Finance Commission', 'Other'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  revenueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  customerName: {
    type: String,
    trim: true
  },
  customerContact: {
    type: String,
    trim: true
  },
  isFromSale: {
    type: Boolean,
    default: false
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled'],
    default: 'confirmed'
  }
}, {
  timestamps: true
});

// Indexes
revenueSchema.index({ revenueDate: -1 });
revenueSchema.index({ source: 1 });
revenueSchema.index({ addedBy: 1 });

module.exports = mongoose.model('Revenue', revenueSchema);