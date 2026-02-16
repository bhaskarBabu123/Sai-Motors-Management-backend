const express = require('express');
const { body, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Sale = require('../models/Sale');
const Bike = require('../models/Bike');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all sales with filtering
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { saleNumber: { $regex: search, $options: 'i' } },
        { buyerName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const sales = await Sale.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('bikeId', 'bikeNumber brand model year')
      .populate('customerId', 'name phone')
      .populate('soldBy', 'name');

    const total = await Sale.countDocuments(query);

    res.json({
      sales,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new sale
router.post('/', auth, [
  body('bikeId').isMongoId().withMessage('Valid bike ID is required'),
  body('buyerName').trim().notEmpty().withMessage('Buyer name is required'),
  body('buyerPhone').trim().notEmpty().withMessage('Buyer phone is required'),
  body('buyerAddress').trim().notEmpty().withMessage('Buyer address is required'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be positive'),
  body('paymentMode').isIn(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const { 
      bikeId, 
      buyerName, 
      buyerPhone, 
      buyerAddress, 
      sellingPrice, 
      discount = 0,
      paymentMode,
      notes 
    } = req.body;

    // Check if bike exists and is available
    const bike = await Bike.findById(bikeId);
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }

    if (bike.status !== 'available') {
      return res.status(400).json({ message: 'Bike is not available for sale' });
    }

    // Find or create customer
    let customer = await Customer.findOne({ phone: buyerPhone });
    if (!customer) {
      customer = new Customer({
        name: buyerName,
        phone: buyerPhone,
        address: buyerAddress
      });
      await customer.save();
    }

    // Calculate profit
    const profit = sellingPrice - discount - bike.buyPrice;
    const profitPercent = (profit / bike.buyPrice) * 100;

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
     const saleNumber = `SAL-${year}${month}-${random}`;
    
      const invoiceNumber = `SB-${year}-${random}`;
  
  // Calculate final amount
 const finalAmount = sellingPrice - discount;
    // Create sale
    const sale = new Sale({
      bikeId,
      saleNumber,
      invoiceNumber,
      finalAmount,
      customerId: customer._id,
      buyerName,
      buyerPhone,
      buyerAddress,
      sellingPrice,
      discount,
      profit,
      profitPercent,
      paymentMode,
      notes,
      soldBy: req.user._id
    });

    await sale.save();

    // Update bike
    bike.sellPrice = sellingPrice;
    bike.profit = profit;
    bike.profitPercent = profitPercent;
    bike.status = 'sold';
    bike.sellDate = new Date();
    bike.saleId = sale._id;
    await bike.save();

    // Update customer
    customer.totalSpent += sellingPrice - discount;
    customer.totalBikesBought += 1;
    customer.lastPurchaseDate = new Date();
    await customer.save();

    // Generate PDF invoice
    const invoicePath = await generateInvoicePDF(sale, bike, customer);
    sale.invoicePath = invoicePath;
    await sale.save();

    // Create payment record if there's remaining amount
    if (sellingPrice - discount > 0) {
      const payment = new Payment({
        saleId: sale._id,
        bikeId,
        customerId: customer._id,
        totalAmount: sellingPrice - discount,
        paidAmount: sellingPrice - discount, // Assuming full payment initially
        remainingAmount: 0
      });
      await payment.save();
    }

    await sale.populate(['bikeId', 'customerId', 'soldBy']);

    res.status(201).json(sale);
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate PDF invoice
async function generateInvoicePDF(sale, bike, customer) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure invoices directory exists
      const invoicesDir = path.join(__dirname, '../invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const doc = new PDFDocument({ margin: 50 });
      const filename = `invoice-${sale.invoiceNumber}.pdf`;
      const filepath = path.join(invoicesDir, filename);
      
      doc.pipe(fs.createWriteStream(filepath));

      // Header
      doc.fontSize(20).text('SAI MOTORS', { align: 'center' });
      doc.fontSize(12).text('BIKE SALES INVOICE', { align: 'center' });
      doc.moveDown();

      // Company details
      doc.text(`${process.env.SHOP_ADDRESS}`);
      doc.text(`Phone: ${process.env.SHOP_PHONE}`);
      doc.text(`Email: ${process.env.SHOP_EMAIL}`);
      doc.moveDown();

      // Invoice details
      doc.text(`Invoice No: ${sale.invoiceNumber}`, { align: 'right' });
      doc.text(`Sale Date: ${sale.createdAt.toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();

      // Customer details
      doc.text('BILL TO:', { underline: true });
      doc.text(`Name: ${customer.name}`);
      doc.text(`Phone: ${customer.phone}`);
      doc.text(`Address: ${customer.address}`);
      doc.moveDown();

      // Bike details
      doc.text('BIKE DETAILS:', { underline: true });
      doc.text(`Bike Number: ${bike.bikeNumber}`);
      doc.text(`Brand: ${bike.brand} ${bike.model}`);
      doc.text(`Year: ${bike.year}`);
      doc.text(`Color: ${bike.color || 'N/A'}`);
      doc.moveDown();

      // Payment details
      doc.text('PAYMENT DETAILS:', { underline: true });
      doc.text(`Selling Price: ₹${sale.sellingPrice.toLocaleString()}`);
      if (sale.discount > 0) {
        doc.text(`Discount: ₹${sale.discount.toLocaleString()}`);
      }
      doc.text(`Final Amount: ₹${sale.finalAmount.toLocaleString()}`, { 
        fontSize: 14, 
        fontWeight: 'bold' 
      });
      doc.text(`Payment Mode: ${sale.paymentMode}`);
      doc.moveDown();

      // Footer
      doc.moveDown(3);
      doc.text('Thank you for your business!', { align: 'center' });
      doc.text('Authorized Signature: ________________', { align: 'right' });

      doc.end();

      doc.on('end', () => {
        resolve(`/invoices/${filename}`);
      });

      doc.on('error', (err) => {
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

// Download invoice PDF
router.get('/invoice/:id',  async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    if (!sale.invoicePath) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const filepath = path.join(__dirname, '..', sale.invoicePath);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Invoice file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${sale.invoiceNumber}.pdf`);
    
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sale statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const stats = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalProfit: { $sum: '$profit' },
          avgSaleAmount: { $avg: '$finalAmount' },
          avgProfit: { $avg: '$profit' }
        }
      }
    ]);

    const result = stats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      avgSaleAmount: 0,
      avgProfit: 0
    };

    res.json(result);
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;