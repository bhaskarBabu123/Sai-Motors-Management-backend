const express = require('express');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all customers with filtering
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search,
      sortBy = 'totalSpent', 
      sortOrder = 'desc' 
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const customers = await Customer.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Customer.countDocuments(query);

    res.json({
      customers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customer by ID with purchase history
router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get customer's purchase history
    const purchases = await Sale.find({ customerId: req.params.id })
      .populate('bikeId', 'bikeNumber brand model year')
      .sort({ createdAt: -1 });

    res.json({
      customer,
      purchases
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new customer
router.post('/', auth, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
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

    // Check for duplicate phone number
    const existingCustomer = await Customer.findOne({ 
      phone: req.body.phone 
    });
    
    if (existingCustomer) {
      return res.status(400).json({ 
        message: 'Customer with this phone number already exists' 
      });
    }

    const customer = new Customer(req.body);
    await customer.save();

    res.status(201).json(customer);
  } catch (error) {
    console.error('Add customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update customer
router.put('/:id', auth, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
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

    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check for duplicate phone number (excluding current customer)
    if (req.body.phone !== customer.phone) {
      const existingCustomer = await Customer.findOne({ 
        phone: req.body.phone,
        _id: { $ne: req.params.id }
      });
      
      if (existingCustomer) {
        return res.status(400).json({ 
          message: 'Customer with this phone number already exists' 
        });
      }
    }

    Object.assign(customer, req.body);
    await customer.save();

    res.json(customer);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete customer
router.delete('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if customer has any sales
    const salesCount = await Sale.countDocuments({ customerId: req.params.id });
    
    if (salesCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete customer with existing sales records' 
      });
    }

    await Customer.findByIdAndDelete(req.params.id);

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customer statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const stats = await Customer.aggregate([
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalSpent: { $sum: '$totalSpent' },
          avgSpentPerCustomer: { $avg: '$totalSpent' },
          totalBikesBought: { $sum: '$totalBikesBought' }
        }
      }
    ]);

    const customerTypes = await Customer.aggregate([
      {
        $group: {
          _id: '$customerType',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = stats[0] || {
      totalCustomers: 0,
      totalSpent: 0,
      avgSpentPerCustomer: 0,
      totalBikesBought: 0
    };

    result.customerTypes = customerTypes;

    res.json(result);
  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;