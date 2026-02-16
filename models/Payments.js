const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Sale = require('../models/Sale');
const Bike = require('../models/Bike');
const Customer = require('../models/Customer');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all payments with filtering
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search,
      status,
      dateFrom,
      dateTo,
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    let payments = await Payment.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('bikeId', 'bikeNumber brand model')
      .populate('customerId', 'name phone')
      .populate('saleId', 'saleNumber invoiceNumber')
      .populate('paymentLogs.receivedBy', 'name');

    // Apply search filter after population
    if (search) {
      payments = payments.filter(payment => 
        payment.bikeId?.bikeNumber?.toLowerCase().includes(search.toLowerCase()) ||
        payment.customerId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        payment.customerId?.phone?.includes(search)
      );
    }

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('bikeId', 'bikeNumber brand model year')
      .populate('customerId', 'name phone email address')
      .populate('saleId', 'saleNumber invoiceNumber sellingPrice')
      .populate('paymentLogs.receivedBy', 'name');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add payment log
router.post('/:id/payment', auth, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('paymentMethod').isIn(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']),
  body('paymentDate').isISO8601().withMessage('Valid payment date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const { amount, paymentMethod, paymentDate, notes } = req.body;

    // Check if payment amount exceeds remaining amount
    if (parseFloat(amount) > payment.remainingAmount) {
      return res.status(400).json({ 
        message: 'Payment amount cannot exceed remaining amount' 
      });
    }

    // Add payment log
    payment.paymentLogs.push({
      amount: parseFloat(amount),
      paymentMethod,
      paymentDate: new Date(paymentDate),
      notes,
      receivedBy: req.user._id
    });

    // Update paid amount
    payment.paidAmount += parseFloat(amount);

    await payment.save();

    // Populate the response
    await payment.populate('bikeId', 'bikeNumber brand model');
    await payment.populate('customerId', 'name phone');
    await payment.populate('paymentLogs.receivedBy', 'name');

    res.json(payment);
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update payment details
router.put('/:id', auth, [
  body('dueDate').optional().isISO8601(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const { dueDate, notes } = req.body;

    if (dueDate) payment.dueDate = new Date(dueDate);
    if (notes !== undefined) payment.notes = notes;

    await payment.save();

    await payment.populate('bikeId', 'bikeNumber brand model');
    await payment.populate('customerId', 'name phone');
    await payment.populate('paymentLogs.receivedBy', 'name');

    res.json(payment);
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalRemaining: { $sum: '$remainingAmount' },
          pendingPayments: { 
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } 
          },
          partialPayments: { 
            $sum: { $cond: [{ $eq: ['$status', 'partial'] }, 1, 0] } 
          },
          completedPayments: { 
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalPayments: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalRemaining: 0,
      pendingPayments: 0,
      partialPayments: 0,
      completedPayments: 0
    };

    res.json(result);
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;