const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema({
  personName: {
    type: String,
    required: true,
    trim: true
  },
  personType: {
    type: String,
    enum: ['Bank', 'Private Lender', 'Finance Company', 'Individual', 'Other'],
    required: true
  },
  contactNumber: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    trim: true
  },
  totalAmountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  totalTransactions: {
    type: Number,
    default: 0,
    min: 0
  },
  lastPaymentDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const financeTransactionSchema = new mongoose.Schema({
  financeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Finance',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'],
    required: true
  },
  purpose: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Indexes
financeSchema.index({ personName: 1 });
financeSchema.index({ personType: 1 });
financeTransactionSchema.index({ financeId: 1 });
financeTransactionSchema.index({ paymentDate: -1 });

const Finance = mongoose.model('Finance', financeSchema);
const FinanceTransaction = mongoose.model('FinanceTransaction', financeTransactionSchema);

module.exports = { Finance, FinanceTransaction };