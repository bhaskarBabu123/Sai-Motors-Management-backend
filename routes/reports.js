const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Bike = require('../models/Bike');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate sales report
router.get('/sales', auth, async (req, res) => {
  try {
    const { format = 'json', dateFrom, dateTo } = req.query;
    
    const query = {};
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const sales = await Sale.find(query)
      .populate('bikeId', 'bikeNumber brand model year')
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 });

    if (format === 'json') {
      res.json(sales);
    } else if (format === 'excel') {
      const filename = await generateSalesExcel(sales);
      res.download(filename, 'sales-report.xlsx', (err) => {
        if (!err) fs.unlinkSync(filename);
      });
    } else if (format === 'pdf') {
      const filename = await generateSalesPDF(sales);
      res.download(filename, 'sales-report.pdf', (err) => {
        if (!err) fs.unlinkSync(filename);
      });
    }
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate inventory report
router.get('/inventory', auth, async (req, res) => {
  try {
    const { format = 'json', status } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const bikes = await Bike.find(query)
      .populate('saleId', 'saleNumber buyerName')
      .sort({ createdAt: -1 });

    if (format === 'json') {
      res.json(bikes);
    } else if (format === 'excel') {
      const filename = await generateInventoryExcel(bikes);
      res.download(filename, 'inventory-report.xlsx', (err) => {
        if (!err) fs.unlinkSync(filename);
      });
    } else if (format === 'pdf') {
      const filename = await generateInventoryPDF(bikes);
      res.download(filename, 'inventory-report.pdf', (err) => {
        if (!err) fs.unlinkSync(filename);
      });
    }
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate customer report
router.get('/customers', auth, async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const customers = await Customer.find()
      .sort({ totalSpent: -1 });

    if (format === 'json') {
      res.json(customers);
    } else if (format === 'excel') {
      const filename = await generateCustomerExcel(customers);
      res.download(filename, 'customer-report.xlsx', (err) => {
        if (!err) fs.unlinkSync(filename);
      });
    } else if (format === 'pdf') {
      const filename = await generateCustomerPDF(customers);
      res.download(filename, 'customer-report.pdf', (err) => {
        if (!err) fs.unlinkSync(filename);
      });
    }
  } catch (error) {
    console.error('Customer report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate profit analysis report
router.get('/profit-analysis', auth, async (req, res) => {
  try {
    const { format = 'json', dateFrom, dateTo } = req.query;
    
    const query = { status: 'sold' };
    if (dateFrom || dateTo) {
      query.sellDate = {};
      if (dateFrom) query.sellDate.$gte = new Date(dateFrom);
      if (dateTo) query.sellDate.$lte = new Date(dateTo);
    }

    const bikes = await Bike.find(query)
      .populate('saleId', 'saleNumber buyerName paymentMode')
      .sort({ profit: -1 });

    const summary = {
      totalBikes: bikes.length,
      totalRevenue: bikes.reduce((sum, bike) => sum + (bike.sellPrice || 0), 0),
      totalProfit: bikes.reduce((sum, bike) => sum + (bike.profit || 0), 0),
      profitableBikes: bikes.filter(bike => bike.profit > 0).length,
      lossBikes: bikes.filter(bike => bike.profit < 0).length,
      avgProfit: bikes.length > 0 ? bikes.reduce((sum, bike) => sum + (bike.profit || 0), 0) / bikes.length : 0
    };

    if (format === 'json') {
      res.json({ summary, bikes });
    } else if (format === 'excel') {
      const filename = await generateProfitAnalysisExcel(summary, bikes);
      res.download(filename, 'profit-analysis.xlsx', (err) => {
        if (!err) fs.unlinkSync(filename);
      });
    } else if (format === 'pdf') {
      const filename = await generateProfitAnalysisPDF(summary, bikes);
      res.download(filename, 'profit-analysis.pdf', (err) => {
        if (!err) fs.unlinkSync(filename);
      });
    }
  } catch (error) {
    console.error('Profit analysis error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper functions for Excel generation
async function generateSalesExcel(sales) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

  worksheet.columns = [
    { header: 'Sale Number', key: 'saleNumber', width: 15 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Bike Number', key: 'bikeNumber', width: 15 },
    { header: 'Brand', key: 'brand', width: 12 },
    { header: 'Model', key: 'model', width: 15 },
    { header: 'Customer', key: 'customer', width: 20 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Selling Price', key: 'sellingPrice', width: 15 },
    { header: 'Discount', key: 'discount', width: 10 },
    { header: 'Final Amount', key: 'finalAmount', width: 15 },
    { header: 'Profit', key: 'profit', width: 12 },
    { header: 'Payment Mode', key: 'paymentMode', width: 15 }
  ];

  sales.forEach(sale => {
    worksheet.addRow({
      saleNumber: sale.saleNumber,
      date: sale.createdAt.toLocaleDateString(),
      bikeNumber: sale.bikeId?.bikeNumber || '',
      brand: sale.bikeId?.brand || '',
      model: sale.bikeId?.model || '',
      customer: sale.buyerName,
      phone: sale.buyerPhone,
      sellingPrice: sale.sellingPrice,
      discount: sale.discount,
      finalAmount: sale.finalAmount,
      profit: sale.profit,
      paymentMode: sale.paymentMode
    });
  });

  worksheet.getRow(1).font = { bold: true };
  
  const filename = path.join(__dirname, '../temp', `sales-report-${Date.now()}.xlsx`);
  
  // Ensure temp directory exists
  const tempDir = path.dirname(filename);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  await workbook.xlsx.writeFile(filename);
  return filename;
}

async function generateInventoryExcel(bikes) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inventory Report');

  worksheet.columns = [
    { header: 'Bike Number', key: 'bikeNumber', width: 15 },
    { header: 'Brand', key: 'brand', width: 12 },
    { header: 'Model', key: 'model', width: 15 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Color', key: 'color', width: 12 },
    { header: 'Buy Price', key: 'buyPrice', width: 12 },
    { header: 'Sell Price', key: 'sellPrice', width: 12 },
    { header: 'Profit', key: 'profit', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
    { header: 'Sell Date', key: 'sellDate', width: 15 }
  ];

  bikes.forEach(bike => {
    worksheet.addRow({
      bikeNumber: bike.bikeNumber,
      brand: bike.brand,
      model: bike.model,
      year: bike.year,
      color: bike.color || '',
      buyPrice: bike.buyPrice,
      sellPrice: bike.sellPrice || '',
      profit: bike.profit || '',
      status: bike.status,
      purchaseDate: bike.purchaseDate.toLocaleDateString(),
      sellDate: bike.sellDate ? bike.sellDate.toLocaleDateString() : ''
    });
  });

  worksheet.getRow(1).font = { bold: true };
  
  const filename = path.join(__dirname, '../temp', `inventory-report-${Date.now()}.xlsx`);
  
  const tempDir = path.dirname(filename);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  await workbook.xlsx.writeFile(filename);
  return filename;
}

async function generateCustomerExcel(customers) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Customer Report');

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'Total Spent', key: 'totalSpent', width: 15 },
    { header: 'Bikes Bought', key: 'totalBikesBought', width: 15 },
    { header: 'Customer Type', key: 'customerType', width: 15 },
    { header: 'Last Purchase', key: 'lastPurchaseDate', width: 15 },
    { header: 'Registration Date', key: 'createdAt', width: 15 }
  ];

  customers.forEach(customer => {
    worksheet.addRow({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address,
      totalSpent: customer.totalSpent,
      totalBikesBought: customer.totalBikesBought,
      customerType: customer.customerType,
      lastPurchaseDate: customer.lastPurchaseDate ? customer.lastPurchaseDate.toLocaleDateString() : '',
      createdAt: customer.createdAt.toLocaleDateString()
    });
  });

  worksheet.getRow(1).font = { bold: true };
  
  const filename = path.join(__dirname, '../temp', `customer-report-${Date.now()}.xlsx`);
  
  const tempDir = path.dirname(filename);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  await workbook.xlsx.writeFile(filename);
  return filename;
}

async function generateProfitAnalysisExcel(summary, bikes) {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Profit Analysis Summary']);
  summarySheet.addRow([]);
  summarySheet.addRow(['Total Bikes Sold', summary.totalBikes]);
  summarySheet.addRow(['Total Revenue', summary.totalRevenue]);
  summarySheet.addRow(['Total Profit', summary.totalProfit]);
  summarySheet.addRow(['Profitable Bikes', summary.profitableBikes]);
  summarySheet.addRow(['Loss Bikes', summary.lossBikes]);
  summarySheet.addRow(['Average Profit', summary.avgProfit]);

  // Detail sheet
  const detailSheet = workbook.addWorksheet('Details');
  detailSheet.columns = [
    { header: 'Bike Number', key: 'bikeNumber', width: 15 },
    { header: 'Brand', key: 'brand', width: 12 },
    { header: 'Model', key: 'model', width: 15 },
    { header: 'Buy Price', key: 'buyPrice', width: 12 },
    { header: 'Sell Price', key: 'sellPrice', width: 12 },
    { header: 'Profit', key: 'profit', width: 12 },
    { header: 'Profit %', key: 'profitPercent', width: 10 },
    { header: 'Days to Sell', key: 'daysToSell', width: 12 }
  ];

  bikes.forEach(bike => {
    detailSheet.addRow({
      bikeNumber: bike.bikeNumber,
      brand: bike.brand,
      model: bike.model,
      buyPrice: bike.buyPrice,
      sellPrice: bike.sellPrice,
      profit: bike.profit,
      profitPercent: bike.profitPercent,
      daysToSell: bike.daysToSell
    });
  });

  summarySheet.getRow(1).font = { bold: true, size: 16 };
  detailSheet.getRow(1).font = { bold: true };

  const filename = path.join(__dirname, '../temp', `profit-analysis-${Date.now()}.xlsx`);
  
  const tempDir = path.dirname(filename);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  await workbook.xlsx.writeFile(filename);
  return filename;
}

// Helper functions for PDF generation
async function generateSalesPDF(sales) {
  return new Promise((resolve, reject) => {
    try {
      const filename = path.join(__dirname, '../temp', `sales-report-${Date.now()}.pdf`);
      
      const tempDir = path.dirname(filename);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filename));

      // Header
      doc.fontSize(16).text('SALES REPORT', { align: 'center' });
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();

      // Table headers
      const tableTop = 100;
      doc.text('Sale#', 50, tableTop);
      doc.text('Date', 120, tableTop);
      doc.text('Bike#', 180, tableTop);
      doc.text('Customer', 250, tableTop);
      doc.text('Amount', 350, tableTop);
      doc.text('Profit', 420, tableTop);

      let y = tableTop + 30;
      sales.forEach(sale => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        doc.text(sale.saleNumber, 50, y, { width: 60, height: 20 });
        doc.text(sale.createdAt.toLocaleDateString(), 120, y, { width: 50, height: 20 });
        doc.text(sale.bikeId?.bikeNumber || '', 180, y, { width: 60, height: 20 });
        doc.text(sale.buyerName, 250, y, { width: 90, height: 20 });
        doc.text(`₹${sale.finalAmount.toLocaleString()}`, 350, y, { width: 60, height: 20 });
        doc.text(`₹${sale.profit.toLocaleString()}`, 420, y, { width: 60, height: 20 });
        
        y += 20;
      });

      doc.end();
      
      doc.on('end', () => {
        resolve(filename);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

async function generateInventoryPDF(bikes) {
  return new Promise((resolve, reject) => {
    try {
      const filename = path.join(__dirname, '../temp', `inventory-report-${Date.now()}.pdf`);
      
      const tempDir = path.dirname(filename);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filename));

      doc.fontSize(16).text('INVENTORY REPORT', { align: 'center' });
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();

      const tableTop = 100;
      doc.text('Bike#', 50, tableTop);
      doc.text('Brand', 120, tableTop);
      doc.text('Model', 180, tableTop);
      doc.text('Status', 250, tableTop);
      doc.text('Buy Price', 320, tableTop);
      doc.text('Profit', 400, tableTop);

      let y = tableTop + 30;
      bikes.forEach(bike => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        doc.text(bike.bikeNumber, 50, y, { width: 60, height: 20 });
        doc.text(bike.brand, 120, y, { width: 50, height: 20 });
        doc.text(bike.model, 180, y, { width: 60, height: 20 });
        doc.text(bike.status, 250, y, { width: 60, height: 20 });
        doc.text(`₹${bike.buyPrice.toLocaleString()}`, 320, y, { width: 70, height: 20 });
        doc.text(bike.profit ? `₹${bike.profit.toLocaleString()}` : '-', 400, y, { width: 70, height: 20 });
        
        y += 20;
      });

      doc.end();
      
      doc.on('end', () => {
        resolve(filename);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

async function generateCustomerPDF(customers) {
  return new Promise((resolve, reject) => {
    try {
      const filename = path.join(__dirname, '../temp', `customer-report-${Date.now()}.pdf`);
      
      const tempDir = path.dirname(filename);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filename));

      doc.fontSize(16).text('CUSTOMER REPORT', { align: 'center' });
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();

      const tableTop = 100;
      doc.text('Name', 50, tableTop);
      doc.text('Phone', 150, tableTop);
      doc.text('Type', 220, tableTop);
      doc.text('Spent', 280, tableTop);
      doc.text('Bikes', 350, tableTop);
      doc.text('Last Purchase', 400, tableTop);

      let y = tableTop + 30;
      customers.forEach(customer => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        doc.text(customer.name, 50, y, { width: 90, height: 20 });
        doc.text(customer.phone, 150, y, { width: 60, height: 20 });
        doc.text(customer.customerType, 220, y, { width: 50, height: 20 });
        doc.text(`₹${customer.totalSpent.toLocaleString()}`, 280, y, { width: 60, height: 20 });
        doc.text(customer.totalBikesBought.toString(), 350, y, { width: 40, height: 20 });
        doc.text(customer.lastPurchaseDate ? customer.lastPurchaseDate.toLocaleDateString() : '-', 400, y, { width: 80, height: 20 });
        
        y += 20;
      });

      doc.end();
      
      doc.on('end', () => {
        resolve(filename);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

async function generateProfitAnalysisPDF(summary, bikes) {
  return new Promise((resolve, reject) => {
    try {
      const filename = path.join(__dirname, '../temp', `profit-analysis-${Date.now()}.pdf`);
      
      const tempDir = path.dirname(filename);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filename));

      doc.fontSize(16).text('PROFIT ANALYSIS REPORT', { align: 'center' });
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();

      // Summary
      doc.fontSize(14).text('Summary', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Bikes Sold: ${summary.totalBikes}`);
      doc.text(`Total Revenue: ₹${summary.totalRevenue.toLocaleString()}`);
      doc.text(`Total Profit: ₹${summary.totalProfit.toLocaleString()}`);
      doc.text(`Profitable Bikes: ${summary.profitableBikes}`);
      doc.text(`Loss Bikes: ${summary.lossBikes}`);
      doc.text(`Average Profit: ₹${summary.avgProfit.toLocaleString()}`);
      doc.moveDown();

      // Details table
      doc.fontSize(14).text('Details', { underline: true });
      
      const tableTop = doc.y + 20;
      doc.fontSize(10);
      doc.text('Bike#', 50, tableTop);
      doc.text('Brand', 120, tableTop);
      doc.text('Buy', 170, tableTop);
      doc.text('Sell', 220, tableTop);
      doc.text('Profit', 270, tableTop);
      doc.text('Profit%', 320, tableTop);
      doc.text('Days', 370, tableTop);

      let y = tableTop + 20;
      bikes.slice(0, 30).forEach(bike => { // Limit to first 30 bikes
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        doc.text(bike.bikeNumber, 50, y, { width: 60 });
        doc.text(bike.brand, 120, y, { width: 40 });
        doc.text(bike.buyPrice.toLocaleString(), 170, y, { width: 40 });
        doc.text(bike.sellPrice.toLocaleString(), 220, y, { width: 40 });
        doc.text(bike.profit.toLocaleString(), 270, y, { width: 40 });
        doc.text(`${bike.profitPercent.toFixed(1)}%`, 320, y, { width: 40 });
        doc.text((bike.daysToSell || 0).toString(), 370, y, { width: 30 });
        
        y += 15;
      });

      doc.end();
      
      doc.on('end', () => {
        resolve(filename);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = router;