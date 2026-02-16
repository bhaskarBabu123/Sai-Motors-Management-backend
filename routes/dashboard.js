const express = require('express');
const mongoose = require('mongoose');
const Bike = require('../models/Bike');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics with filtering
router.get('/', auth, async (req, res) => {
  try {
    const { filter = 'thisMonth' } = req.query;
    
    // Calculate date range based on filter
    const dateRange = getDateRange(filter);
    
    // Parallel queries for better performance
    const [
      bikeStats,
      salesStats,
      revenueData,
      brandStats,
      monthlyData,
      topProfitBikes,
      slowMovingBikes,
      customerStats
    ] = await Promise.all([
      getBikeStats(dateRange),
      getSalesStats(dateRange),
      getRevenueData(dateRange),
      getBrandStats(dateRange),
      getMonthlyData(),
      getTopProfitBikes(5),
      getSlowMovingBikes(),
      getCustomerStats(dateRange)
    ]);

    res.json({
      // Overview stats
      totalBikes: bikeStats.totalBikes,
      availableBikes: bikeStats.availableBikes,
      soldBikes: bikeStats.soldBikes,
      reservedBikes: bikeStats.reservedBikes,
      totalRevenue: salesStats.totalRevenue || 0,
      totalProfit: salesStats.totalProfit || 0,
      lossBikes: bikeStats.lossBikes,
      avgProfit: salesStats.avgProfit || 0,
      
      // Chart data
      revenueData,
      brandStats,
      monthlyData,
      topProfitBikes,
      slowMovingBikes,
      
      // Additional insights
      totalCustomers: customerStats.totalCustomers,
      newCustomers: customerStats.newCustomers,
      avgSaleValue: salesStats.avgSaleValue || 0,
      profitMargin: salesStats.totalRevenue > 0 ? ((salesStats.totalProfit / salesStats.totalRevenue) * 100) : 0
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to get date range
function getDateRange(filter) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case 'today':
      return {
        start: startOfDay,
        end: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
      };
    
    case 'thisWeek':
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      return {
        start: startOfWeek,
        end: now
      };
    
    case 'thisMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now
      };
    
    case 'lastMonth':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: lastMonth,
        end: endLastMonth
      };
    
    case 'thisYear':
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: now
      };
    
    default:
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now
      };
  }
}

// Get bike statistics
async function getBikeStats(dateRange) {
  const totalStats = await Bike.aggregate([
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
        reservedBikes: { 
          $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] } 
        },
        lossBikes: { 
          $sum: { 
            $cond: [
              { $and: [{ $eq: ['$status', 'sold'] }, { $lt: ['$profit', 0] }] }, 
              1, 
              0
            ] 
          } 
        }
      }
    }
  ]);

  return totalStats[0] || {
    totalBikes: 0,
    availableBikes: 0,
    soldBikes: 0,
    reservedBikes: 0,
    lossBikes: 0
  };
}

// Get sales statistics
async function getSalesStats(dateRange) {
  const matchQuery = {
    createdAt: {
      $gte: dateRange.start,
      $lte: dateRange.end
    }
  };

  const salesStats = await Sale.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$finalAmount' },
        totalProfit: { $sum: '$profit' },
        avgSaleValue: { $avg: '$finalAmount' },
        avgProfit: { $avg: '$profit' }
      }
    }
  ]);

  return salesStats[0] || {
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    avgSaleValue: 0,
    avgProfit: 0
  };
}

// Get revenue data for charts
async function getRevenueData(dateRange) {
  return await Sale.aggregate([
    {
      $match: {
        createdAt: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$finalAmount' },
        profit: { $sum: '$profit' },
        sales: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        revenue: 1,
        profit: 1,
        sales: 1
      }
    }
  ]);
}

// Get brand statistics
async function getBrandStats(dateRange) {
  return await Sale.aggregate([
    {
      $match: {
        createdAt: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      }
    },
    {
      $lookup: {
        from: 'bikes',
        localField: 'bikeId',
        foreignField: '_id',
        as: 'bike'
      }
    },
    { $unwind: '$bike' },
    {
      $group: {
        _id: '$bike.brand',
        sales: { $sum: 1 },
        revenue: { $sum: '$finalAmount' },
        profit: { $sum: '$profit' }
      }
    },
    {
      $sort: { sales: -1 }
    }
  ]);
}

// Get monthly data for the last 12 months
async function getMonthlyData() {
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  return await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: lastYear }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$finalAmount' },
        profit: { $sum: '$profit' },
        sales: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);
}

// Get top profit bikes
async function getTopProfitBikes(limit = 5) {
  return await Bike.find({ 
    status: 'sold',
    profit: { $gt: 0 }
  })
  .sort({ profit: -1 })
  .limit(limit)
  .select('bikeNumber brand model profit profitPercent sellPrice');
}

// Get slow moving bikes (available for more than 30 days)
async function getSlowMovingBikes() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return await Bike.find({
    status: 'available',
    purchaseDate: { $lt: thirtyDaysAgo }
  })
  .select('bikeNumber brand model purchaseDate buyPrice')
  .sort({ purchaseDate: 1 });
}

// Get customer statistics
async function getCustomerStats(dateRange) {
  const [totalCustomers, newCustomers] = await Promise.all([
    Customer.countDocuments(),
    Customer.countDocuments({
      createdAt: {
        $gte: dateRange.start,
        $lte: dateRange.end
      }
    })
  ]);

  return {
    totalCustomers,
    newCustomers
  };
}

module.exports = router;