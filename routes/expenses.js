const express = require('express');
const { body, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all expenses
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search,
      category,
      dateFrom,
      dateTo,
      sortBy = 'expenseDate', 
      sortOrder = 'desc' 
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'vendor.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    
    if (dateFrom || dateTo) {
      query.expenseDate = {};
      if (dateFrom) query.expenseDate.$gte = new Date(dateFrom);
      if (dateTo) query.expenseDate.$lte = new Date(dateTo);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const expenses = await Expense.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('addedBy', 'name');

    const total = await Expense.countDocuments(query);

    res.json({
      expenses,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add expense
router.post('/', auth, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('category').isIn(['Office Rent', 'Utilities', 'Marketing', 'Maintenance', 'Staff Salary', 'Transportation', 'Insurance', 'Legal', 'Other']),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('paymentMethod').isIn(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']),
  body('expenseDate').isISO8601().withMessage('Valid expense date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const expense = new Expense({
      ...req.body,
      addedBy: req.user._id
    });

    await expense.save();
    await expense.populate('addedBy', 'name');

    res.status(201).json(expense);
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update expense
router.put('/:id', auth, [
  body('title').optional().trim().notEmpty(),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('category').optional().isIn(['Office Rent', 'Utilities', 'Marketing', 'Maintenance', 'Staff Salary', 'Transportation', 'Insurance', 'Legal', 'Other']),
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

    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('addedBy', 'name');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete expense
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get expense statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const stats = await Expense.aggregate([
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgExpenseAmount: { $avg: '$amount' }
        }
      }
    ]);

    const categoryStats = await Expense.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    const result = {
      ...(stats[0] || {
        totalExpenses: 0,
        totalAmount: 0,
        avgExpenseAmount: 0
      }),
      categoryBreakdown: categoryStats
    };

    res.json(result);
  } catch (error) {
    console.error('Get expense stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;