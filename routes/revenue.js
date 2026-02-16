const express = require('express');
const { body, validationResult } = require('express-validator');
const Revenue = require('../models/Revenue');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all revenue entries
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search,
      source,
      dateFrom,
      dateTo,
      sortBy = 'revenueDate', 
      sortOrder = 'desc' 
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (source) query.source = source;
    
    if (dateFrom || dateTo) {
      query.revenueDate = {};
      if (dateFrom) query.revenueDate.$gte = new Date(dateFrom);
      if (dateTo) query.revenueDate.$lte = new Date(dateTo);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const revenues = await Revenue.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('addedBy', 'name')
      .populate('saleId', 'saleNumber invoiceNumber');

    const total = await Revenue.countDocuments(query);

    res.json({
      revenues,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get revenues error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add revenue entry
router.post('/', auth, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('source').isIn(['Bike Sales', 'Service', 'Parts', 'Accessories', 'Insurance Commission', 'Finance Commission', 'Other']),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('paymentMethod').isIn(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']),
  body('revenueDate').isISO8601().withMessage('Valid revenue date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const revenue = new Revenue({
      ...req.body,
      addedBy: req.user._id
    });

    await revenue.save();
    await revenue.populate('addedBy', 'name');

    res.status(201).json(revenue);
  } catch (error) {
    console.error('Add revenue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update revenue entry
router.put('/:id', auth, [
  body('title').optional().trim().notEmpty(),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('source').optional().isIn(['Bike Sales', 'Service', 'Parts', 'Accessories', 'Insurance Commission', 'Finance Commission', 'Other']),
  body('paymentMethod').optional().isIn(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const revenue = await Revenue.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('addedBy', 'name');

    if (!revenue) {
      return res.status(404).json({ message: 'Revenue entry not found' });
    }

    res.json(revenue);
  } catch (error) {
    console.error('Update revenue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete revenue entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const revenue = await Revenue.findByIdAndDelete(req.params.id);
    
    if (!revenue) {
      return res.status(404).json({ message: 'Revenue entry not found' });
    }

    res.json({ message: 'Revenue entry deleted successfully' });
  } catch (error) {
    console.error('Delete revenue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get revenue statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const stats = await Revenue.aggregate([
      {
        $group: {
          _id: null,
          totalRevenues: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgRevenueAmount: { $avg: '$amount' }
        }
      }
    ]);

    const sourceStats = await Revenue.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    const result = {
      ...(stats[0] || {
        totalRevenues: 0,
        totalAmount: 0,
        avgRevenueAmount: 0
      }),
      sourceBreakdown: sourceStats
    };

    res.json(result);
  } catch (error) {
    console.error('Get revenue stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;