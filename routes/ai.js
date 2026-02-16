const express = require('express');
const Bike = require('../models/Bike');
const Sale = require('../models/Sale');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get AI insights and predictions
router.get('/insights', auth, async (req, res) => {
  try {
    // Get data for AI analysis
    const [
      totalBikes,
      soldBikes,
      recentSales,
      brandPerformance,
      slowMovingBikes,
      topProfitBikes
    ] = await Promise.all([
      Bike.countDocuments(),
      Bike.find({ status: 'sold' }).populate('saleId'),
      Sale.find().sort({ createdAt: -1 }).limit(50).populate('bikeId'),
      getBrandPerformance(),
      getSlowMovingBikes(),
      getTopProfitBikes()
    ]);

    // Generate AI insights
    const insights = generateInsights({
      totalBikes,
      soldBikes,
      recentSales,
      brandPerformance,
      slowMovingBikes,
      topProfitBikes
    });

    res.json(insights);
  } catch (error) {
    console.error('AI insights error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get price suggestions for a specific bike
router.get('/price-suggestion/:bikeId', auth, async (req, res) => {
  try {
    const bike = await Bike.findById(req.params.bikeId);
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }

    // Get similar bikes data
    const similarBikes = await Bike.find({
      brand: bike.brand,
      status: 'sold',
      year: { $gte: bike.year - 2, $lte: bike.year + 2 }
    });

    const suggestion = generatePriceSuggestion(bike, similarBikes);

    res.json(suggestion);
  } catch (error) {
    console.error('Price suggestion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get demand predictions
router.get('/demand-predictions', auth, async (req, res) => {
  try {
    const salesData = await Sale.aggregate([
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
          _id: {
            brand: '$bike.brand',
            month: { $month: '$createdAt' }
          },
          sales: { $sum: 1 },
          avgProfit: { $avg: '$profit' }
        }
      }
    ]);

    const predictions = generateDemandPredictions(salesData);

    res.json(predictions);
  } catch (error) {
    console.error('Demand predictions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper functions
async function getBrandPerformance() {
  return await Sale.aggregate([
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
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$finalAmount' },
        totalProfit: { $sum: '$profit' },
        avgDaysToSell: { $avg: '$bike.daysToSell' }
      }
    },
    { $sort: { totalSales: -1 } }
  ]);
}

async function getSlowMovingBikes() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return await Bike.find({
    status: 'available',
    purchaseDate: { $lt: thirtyDaysAgo }
  }).sort({ purchaseDate: 1 });
}

async function getTopProfitBikes() {
  return await Bike.find({
    status: 'sold',
    profit: { $gt: 0 }
  }).sort({ profitPercent: -1 }).limit(10);
}

function generateInsights(data) {
  const insights = [];

  // Best selling brand insight
  if (data.brandPerformance.length > 0) {
    const topBrand = data.brandPerformance[0];
    insights.push({
      type: 'success',
      title: 'Best Selling Brand',
      message: `${topBrand._id} bikes are your top performers with ${topBrand.totalSales} sales and ${Math.round(topBrand.avgDaysToSell || 30)} average days to sell.`,
      priority: 'high'
    });
  }

  // Profit optimization
  const highProfitBikes = data.topProfitBikes.filter(bike => bike.profitPercent > 20);
  if (highProfitBikes.length > 0) {
    insights.push({
      type: 'info',
      title: 'High Profit Opportunity',
      message: `${highProfitBikes.length} bike models show >20% profit margin. Consider stocking more of these models.`,
      priority: 'medium'
    });
  }

  // Slow moving inventory alert
  if (data.slowMovingBikes.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Inventory Alert',
      message: `${data.slowMovingBikes.length} bikes have been in inventory for over 30 days. Consider pricing adjustments.`,
      priority: 'high'
    });
  }

  // Price suggestion insight
  const avgProfit = data.soldBikes.reduce((sum, bike) => sum + (bike.profit || 0), 0) / data.soldBikes.length;
  if (avgProfit < 15000) {
    insights.push({
      type: 'suggestion',
      title: 'Price Optimization',
      message: `Current average profit is ₹${Math.round(avgProfit)}. Consider increasing prices by 5-10% for better margins.`,
      priority: 'medium'
    });
  }

  // Revenue prediction
  const lastMonthSales = data.recentSales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return saleDate >= lastMonth;
  });

  const predictedRevenue = lastMonthSales.reduce((sum, sale) => sum + sale.finalAmount, 0) * 1.1;
  
  insights.push({
    type: 'prediction',
    title: 'Revenue Forecast',
    message: `Based on current trends, predicted revenue for next month: ₹${Math.round(predictedRevenue).toLocaleString()}`,
    priority: 'low'
  });

  return insights;
}

function generatePriceSuggestion(bike, similarBikes) {
  if (similarBikes.length === 0) {
    return {
      suggestedPrice: bike.buyPrice * 1.15, // 15% markup as default
      confidence: 'low',
      reasoning: 'No similar bikes found. Suggesting 15% markup.',
      marketData: null
    };
  }

  const avgSellPrice = similarBikes.reduce((sum, b) => sum + b.sellPrice, 0) / similarBikes.length;
  const avgProfit = similarBikes.reduce((sum, b) => sum + b.profit, 0) / similarBikes.length;
  const avgDaysToSell = similarBikes.reduce((sum, b) => sum + (b.daysToSell || 30), 0) / similarBikes.length;

  // Adjust price based on age and condition
  let adjustmentFactor = 1;
  const currentYear = new Date().getFullYear();
  const ageAdjustment = (currentYear - bike.year) * 0.05; // 5% reduction per year
  adjustmentFactor -= ageAdjustment;

  // Condition adjustment
  if (bike.conditionRating) {
    const conditionAdjustment = (bike.conditionRating - 8) * 0.02; // 2% per rating point difference from 8
    adjustmentFactor += conditionAdjustment;
  }

  const suggestedPrice = Math.round(avgSellPrice * adjustmentFactor);

  return {
    suggestedPrice,
    confidence: similarBikes.length >= 3 ? 'high' : 'medium',
    reasoning: `Based on ${similarBikes.length} similar ${bike.brand} bikes. Average market price: ₹${Math.round(avgSellPrice)}, adjusted for age and condition.`,
    marketData: {
      avgSellPrice: Math.round(avgSellPrice),
      avgProfit: Math.round(avgProfit),
      avgDaysToSell: Math.round(avgDaysToSell),
      sampleSize: similarBikes.length
    }
  };
}

function generateDemandPredictions(salesData) {
  const brandTrends = {};
  
  salesData.forEach(record => {
    const brand = record._id.brand;
    const month = record._id.month;
    
    if (!brandTrends[brand]) {
      brandTrends[brand] = [];
    }
    
    brandTrends[brand].push({
      month,
      sales: record.sales,
      avgProfit: record.avgProfit
    });
  });

  const predictions = [];
  
  Object.keys(brandTrends).forEach(brand => {
    const trend = brandTrends[brand];
    const avgSales = trend.reduce((sum, t) => sum + t.sales, 0) / trend.length;
    const avgProfit = trend.reduce((sum, t) => sum + t.avgProfit, 0) / trend.length;
    
    // Simple trend analysis
    let trendDirection = 'stable';
    if (trend.length >= 2) {
      const recent = trend.slice(-2);
      const growth = (recent[1].sales - recent[0].sales) / recent[0].sales;
      
      if (growth > 0.1) trendDirection = 'increasing';
      else if (growth < -0.1) trendDirection = 'decreasing';
    }
    
    predictions.push({
      brand,
      avgMonthlySales: Math.round(avgSales),
      avgProfit: Math.round(avgProfit),
      trend: trendDirection,
      recommendation: getTrendRecommendation(trendDirection, avgProfit)
    });
  });

  return predictions.sort((a, b) => b.avgMonthlySales - a.avgMonthlySales);
}

function getTrendRecommendation(trend, avgProfit) {
  if (trend === 'increasing' && avgProfit > 10000) {
    return 'Strong performer - consider increasing inventory';
  } else if (trend === 'increasing') {
    return 'Growing demand - monitor pricing for better margins';
  } else if (trend === 'decreasing') {
    return 'Declining sales - review pricing strategy or reduce inventory';
  } else if (avgProfit > 15000) {
    return 'Stable with good margins - maintain current strategy';
  } else {
    return 'Stable but low margins - consider price optimization';
  }
}

module.exports = router;