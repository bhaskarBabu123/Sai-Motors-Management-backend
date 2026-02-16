const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['Office Rent', 'Utilities', 'Marketing', 'Maintenance', 'Staff Salary', 'Transportation', 'Insurance', 'Legal', 'Other'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  expenseDate: {
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
  receipt: {
    fileName: String,
    filePath: String
  },
  vendor: {
    name: String,
    contact: String,
    address: String
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPeriod: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: function() { return this.isRecurring; }
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'approved'
  }
}, {
  timestamps: true
});

// Indexes
expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ addedBy: 1 });

module.exports = mongoose.model('Expense', expenseSchema);