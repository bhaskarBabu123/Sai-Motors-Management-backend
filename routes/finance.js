const express = require('express');
const { body, validationResult } = require('express-validator');
const { Finance, FinanceTransaction } = require('../models/Finance');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all finance persons
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search,
      personType,
      status,
      sortBy = 'totalAmountPaid', 
      sortOrder = 'desc' 
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { personName: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (personType) query.personType = personType;
    if (status) query.status = status;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const financePersons = await Finance.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Finance.countDocuments(query);

    res.json({
      financePersons,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get finance persons error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add finance person
router.post('/', auth, [
  body('personName').trim().notEmpty().withMessage('Person name is required'),
  body('personType').isIn(['Bank', 'Private Lender', 'Finance Company', 'Individual', 'Other']),
  body('contactNumber').optional().trim(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const financePerson = new Finance(req.body);
    await financePerson.save();

    res.status(201).json(financePerson);
  } catch (error) {
    console.error('Add finance person error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get finance transactions
router.get('/transactions', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      financeId,
      dateFrom,
      dateTo,
      sortBy = 'paymentDate', 
      sortOrder = 'desc' 
    } = req.query;

    const query = {};
    
    if (financeId) query.financeId = financeId;
    
    if (dateFrom || dateTo) {
      query.paymentDate = {};
      if (dateFrom) query.paymentDate.$gte = new Date(dateFrom);
      if (dateTo) query.paymentDate.$lte = new Date(dateTo);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const transactions = await FinanceTransaction.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('financeId', 'personName personType')
      .populate('paidBy', 'name');

    const total = await FinanceTransaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get finance transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add finance transaction
router.post('/transactions', auth, [
  body('financeId').isMongoId().withMessage('Valid finance ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('paymentMethod').isIn(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
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

    const transaction = new FinanceTransaction({
      ...req.body,
      paidBy: req.user._id
    });

    await transaction.save();

    // Update finance person totals
    const financePerson = await Finance.findById(req.body.financeId);
    if (financePerson) {
      financePerson.totalAmountPaid += parseFloat(req.body.amount);
      financePerson.totalTransactions += 1;
      financePerson.lastPaymentDate = new Date(req.body.paymentDate);
      await financePerson.save();
    }

    await transaction.populate('financeId', 'personName personType');
    await transaction.populate('paidBy', 'name');

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Add finance transaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get finance statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const [financeStats, transactionStats] = await Promise.all([
      Finance.aggregate([
        {
          $group: {
            _id: null,
            totalFinancePersons: { $sum: 1 },
            totalAmountPaid: { $sum: '$totalAmountPaid' },
            activePersons: { 
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } 
            }
          }
        }
      ]),
      FinanceTransaction.aggregate([
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgTransactionAmount: { $avg: '$amount' }
          }
        }
      ])
    ]);

    const result = {
      ...(financeStats[0] || {
        totalFinancePersons: 0,
        totalAmountPaid: 0,
        activePersons: 0
      }),
      ...(transactionStats[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        avgTransactionAmount: 0
      })
    };

    res.json(result);
  } catch (error) {
    console.error('Get finance stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;