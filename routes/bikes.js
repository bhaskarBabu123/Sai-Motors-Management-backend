const express = require('express');
const { body, validationResult } = require('express-validator');
const Bike = require('../models/Bike');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all bikes with filtering and sorting
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search, 
      brand, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { bikeNumber: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (brand) query.brand = brand;
    if (status) query.status = status;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const bikes = await Bike.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('saleId', 'saleNumber invoiceNumber buyerName');

    const total = await Bike.countDocuments(query);

    res.json({
      bikes,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get bikes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bike by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const bike = await Bike.findById(req.params.id).populate('saleId');
    
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }

    res.json(bike);
  } catch (error) {
    console.error('Get bike error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new bike
router.post('/', auth, [
  body('bikeNumber').trim().notEmpty().withMessage('Bike number is required'),
  body('brand').isIn(['Honda', 'Yamaha', 'Bajaj', 'TVS', 'Hero', 'KTM', 'Royal Enfield', 'Suzuki', 'Kawasaki']),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('year').isInt({ min: 1990, max: new Date().getFullYear() + 1 }),
  body('buyPrice').isFloat({ min: 0 }).withMessage('Buy price must be positive'),
  body('purchaseDate').isISO8601().withMessage('Valid purchase date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    // Check for duplicate bike number
    const existingBike = await Bike.findOne({ 
      bikeNumber: req.body.bikeNumber.toUpperCase() 
    });
    
    if (existingBike) {
      return res.status(400).json({ 
        message: 'Bike number already exists' 
      });
    }

    const bike = new Bike({
      ...req.body,
      bikeNumber: req.body.bikeNumber.toUpperCase()
    });

    await bike.save();

    res.status(201).json(bike);
  } catch (error) {
    console.error('Add bike error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update bike
router.put('/:id', auth, [
  body('bikeNumber').trim().notEmpty().withMessage('Bike number is required'),
  body('brand').isIn(['Honda', 'Yamaha', 'Bajaj', 'TVS', 'Hero', 'KTM', 'Royal Enfield', 'Suzuki', 'Kawasaki']),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('year').isInt({ min: 1990, max: new Date().getFullYear() + 1 }),
  body('buyPrice').isFloat({ min: 0 }).withMessage('Buy price must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const bike = await Bike.findById(req.params.id);
    
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }

    // Check if bike is sold
    if (bike.status === 'sold') {
      return res.status(400).json({ 
        message: 'Cannot update sold bike' 
      });
    }

    // Check for duplicate bike number (excluding current bike)
    if (req.body.bikeNumber.toUpperCase() !== bike.bikeNumber) {
      const existingBike = await Bike.findOne({ 
        bikeNumber: req.body.bikeNumber.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      
      if (existingBike) {
        return res.status(400).json({ 
          message: 'Bike number already exists' 
        });
      }
    }

    Object.assign(bike, {
      ...req.body,
      bikeNumber: req.body.bikeNumber.toUpperCase()
    });

    await bike.save();

    res.json(bike);
  } catch (error) {
    console.error('Update bike error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete bike
router.delete('/:id', auth, async (req, res) => {
  try {
    const bike = await Bike.findById(req.params.id);
    
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }

    if (bike.status === 'sold') {
      return res.status(400).json({ 
        message: 'Cannot delete sold bike' 
      });
    }

    await Bike.findByIdAndDelete(req.params.id);

    res.json({ message: 'Bike deleted successfully' });
  } catch (error) {
    console.error('Delete bike error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bike statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const stats = await Bike.aggregate([
      {
        $group: {
          _id: null,
          totalBikes: { $sum: 1 },
          availableBikes: { 
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } 
          },
          soldBikes: { 
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } 
          },
          totalInvestment: { 
            $sum: '$buyPrice' 
          },
          totalRevenue: { 
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$sellPrice', 0] } 
          },
          totalProfit: { 
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$profit', 0] } 
          },
          avgProfit: { 
            $avg: { $cond: [{ $eq: ['$status', 'sold'] }, '$profit', null] } 
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalBikes: 0,
      availableBikes: 0,
      soldBikes: 0,
      totalInvestment: 0,
      totalRevenue: 0,
      totalProfit: 0,
      avgProfit: 0
    };

    // Get loss bikes count
    const lossBikes = await Bike.countDocuments({ 
      status: 'sold', 
      profit: { $lt: 0 } 
    });

    result.lossBikes = lossBikes;

    res.json(result);
  } catch (error) {
    console.error('Get bike stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;