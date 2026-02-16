const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  saleNumber: {
    type: String,
    required: true,
    unique: true
  },
  bikeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bike',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  buyerName: {
    type: String,
    required: true,
    trim: true
  },
  buyerPhone: {
    type: String,
    required: true,
    trim: true
  },
  buyerAddress: {
    type: String,
    required: true,
    trim: true
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  profit: {
    type: Number,
    required: true
  },
  profitPercent: {
    type: Number,
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Partial'],
    default: 'Paid'
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  invoicePath: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  },
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Generate sale number and invoice number
saleSchema.pre('save', function(next) {
  
  
  next();
});

// Indexes
saleSchema.index({ createdAt: -1 });
saleSchema.index({ bikeId: 1 });
saleSchema.index({ customerId: 1 });
saleSchema.index({ invoiceNumber: 1 });

module.exports = mongoose.model('Sale', saleSchema);