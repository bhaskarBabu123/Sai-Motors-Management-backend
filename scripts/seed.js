const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Bike = require('../models/Bike');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');

// Sample data
const brands = ['Honda', 'Yamaha', 'Bajaj', 'TVS', 'Hero', 'KTM', 'Royal Enfield', 'Suzuki', 'Kawasaki'];
const models = {
  Honda: ['Activa 6G', 'CB Shine', 'SP 125', 'Hornet 2.0', 'CBR 150R', 'Unicorn'],
  Yamaha: ['Fascino 125', 'Ray ZR', 'FZ-S', 'MT-15', 'R15 V4', 'Aerox 155'],
  Bajaj: ['Pulsar 150', 'Pulsar NS200', 'Avenger 160', 'CT 110X', 'Chetak'],
  TVS: ['Jupiter', 'NTorq 125', 'Apache RTR 160', 'Apache RR 310', 'iQube'],
  Hero: ['Splendor Plus', 'HF Deluxe', 'Passion Pro', 'Xtreme 125R', 'Destini 125'],
  KTM: ['Duke 125', 'Duke 200', 'Duke 390', 'RC 125', 'RC 200'],
  'Royal Enfield': ['Classic 350', 'Bullet 350', 'Himalayan', 'Interceptor 650', 'Meteor 350'],
  Suzuki: ['Access 125', 'Burgman Street', 'Gixxer SF', 'Hayabusa'],
  Kawasaki: ['Ninja 300', 'Z900', 'Versys-X 300', 'W175']
};

const colors = ['Black', 'White', 'Red', 'Blue', 'Silver', 'Grey', 'Green', 'Yellow', 'Orange'];
const fuelTypes = ['Petrol', 'Electric'];
const paymentModes = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

// Helper functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateBikeNumber() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let bikeNumber = '';
  // Add 2 letters
  for (let i = 0; i < 2; i++) {
    bikeNumber += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  // Add 2 numbers
  for (let i = 0; i < 2; i++) {
    bikeNumber += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  // Add 2 letters
  for (let i = 0; i < 2; i++) {
    bikeNumber += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  // Add 4 numbers
  for (let i = 0; i < 4; i++) {
    bikeNumber += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return bikeNumber;
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to MongoDB
    await mongoose.connect("mongodb+srv://bhaskarAntoty123:MQEJ1W9gtKD547hy@bhaskarantony.wagpkay.mongodb.net/sai_bikes?retryWrites=true&w=majority");
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Bike.deleteMany({}),
      Customer.deleteMany({}),
      Sale.deleteMany({})
    ]);
    console.log('🧹 Cleared existing data');

    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@saibikes.com',
      password: 'admin123',
      role: 'admin'
    });
    await adminUser.save();
    console.log('👤 Created admin user');

    // Create customers
    const customers = [];
    const indianNames = [
      'Rajesh Kumar', 'Priya Sharma', 'Amit Singh', 'Sunita Patel', 'Vikram Gupta',
      'Anita Joshi', 'Ravi Agarwal', 'Meera Shah', 'Suresh Reddy', 'Kavya Nair',
      'Manoj Verma', 'Deepika Rao', 'Arjun Prasad', 'Pooja Sinha', 'Kiran Khanna',
      'Sneha Kapoor', 'Rohit Mishra', 'Nisha Tiwari', 'Ajay Pandey', 'Ritu Jain'
    ];

    for (let i = 0; i < 30; i++) {
      const name = indianNames[i % indianNames.length];
      const customer = new Customer({
        name: `${name} ${i > 19 ? getRandomNumber(1, 99) : ''}`,
        phone: `${getRandomNumber(7000000000, 9999999999)}`,
        email: i % 3 === 0 ? `customer${i}@email.com` : undefined,
        address: `${getRandomNumber(1, 999)} ${getRandomElement(['MG Road', 'Brigade Road', 'Commercial Street', 'Whitefield', 'Koramangala', 'Indiranagar'])}, Bangalore - ${getRandomNumber(560001, 560099)}`,
        occupation: getRandomElement(['Engineer', 'Doctor', 'Teacher', 'Businessman', 'Student', 'Government Employee']),
        dateOfBirth: getRandomDate(new Date(1970, 0, 1), new Date(2000, 11, 31))
      });
      customers.push(customer);
    }
    await Customer.insertMany(customers);
    console.log(`👥 Created ${customers.length} customers`);

    // Create bikes
    const bikes = [];
    const usedBikeNumbers = new Set();

    for (let i = 0; i < 80; i++) {
      let bikeNumber;
      do {
        bikeNumber = generateBikeNumber();
      } while (usedBikeNumbers.has(bikeNumber));
      usedBikeNumbers.add(bikeNumber);

      const brand = getRandomElement(brands);
      const model = getRandomElement(models[brand]);
      const year = getRandomNumber(2018, 2024);
      const purchaseDate = getRandomDate(
        new Date(2023, 0, 1), 
        new Date(2024, 10, 31)
      );

      // Price calculation based on brand and year
      let basePrice;
      switch (brand) {
        case 'KTM':
        case 'Royal Enfield':
        case 'Kawasaki':
          basePrice = getRandomNumber(120000, 300000);
          break;
        case 'Honda':
        case 'Yamaha':
          basePrice = getRandomNumber(70000, 180000);
          break;
        case 'Bajaj':
        case 'TVS':
          basePrice = getRandomNumber(60000, 150000);
          break;
        default:
          basePrice = getRandomNumber(50000, 120000);
      }

      // Age-based price adjustment
      const ageAdjustment = (2024 - year) * 0.1;
      const buyPrice = Math.round(basePrice * (1 - ageAdjustment));

      const bike = new Bike({
        bikeNumber,
        brand,
        model,
        year,
        buyPrice,
        purchaseDate,
        color: getRandomElement(colors),
        fuelType: getRandomElement(fuelTypes),
        mileage: brand === 'KTM' || brand === 'Royal Enfield' ? getRandomNumber(15, 25) : getRandomNumber(40, 70),
        engineCC: getRandomNumber(100, 650),
        conditionRating: getRandomNumber(6, 10),
        notes: i % 5 === 0 ? 'Excellent condition, well maintained' : undefined,
        status: 'available'
      });

      bikes.push(bike);
    }

    await Bike.insertMany(bikes);
    console.log(`🏍️ Created ${bikes.length} bikes`);

    // Create sales (sell some bikes)
    const sales = [];
    const bikesToSell = bikes.slice(0, 50); // Sell first 50 bikes

    for (let i = 0; i < bikesToSell.length; i++) {
      const bike = bikesToSell[i];
      const customer = customers[i % customers.length];

      // Calculate selling price with some profit margin
      const profitMultiplier = 1 + (getRandomNumber(5, 25) / 100); // 5% to 25% profit
      const sellingPrice = Math.round(bike.buyPrice * profitMultiplier);
      
      const discount = i % 7 === 0 ? getRandomNumber(2000, 5000) : 0;
      const finalAmount = sellingPrice - discount;
      const profit = finalAmount - bike.buyPrice;
      const profitPercent = (profit / bike.buyPrice) * 100;

      const saleDate = getRandomDate(
        new Date(Math.max(bike.purchaseDate.getTime(), new Date(2024, 0, 1).getTime())),
        new Date()
      );

      const sale = new Sale({
        bikeId: bike._id,
        customerId: customer._id,
        buyerName: customer.name,
        buyerPhone: customer.phone,
        buyerAddress: customer.address,
        sellingPrice,
        discount,
        finalAmount,
        profit,
        profitPercent,
        paymentMode: getRandomElement(paymentModes),
        notes: i % 8 === 0 ? 'Customer very satisfied with the purchase' : undefined,
        soldBy: adminUser._id,
        createdAt: saleDate
      });

      sales.push(sale);

      // Update bike
      bike.sellPrice = sellingPrice;
      bike.profit = profit;
      bike.profitPercent = profitPercent;
      bike.status = 'sold';
      bike.sellDate = saleDate;
      bike.saleId = sale._id;

      const timeDiff = saleDate.getTime() - bike.purchaseDate.getTime();
      bike.daysToSell = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // Update customer
      customer.totalSpent += finalAmount;
      customer.totalBikesBought += 1;
      customer.lastPurchaseDate = saleDate;
    }

    await Sale.insertMany(sales);
    console.log(`💰 Created ${sales.length} sales`);

    // Update bikes with sale information
    await Promise.all(bikesToSell.map(bike => bike.save()));
    
    // Update customers with purchase information
    await Promise.all(customers.map(customer => customer.save()));

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Admin User: admin@saibikes.com / admin123`);
    console.log(`- Customers: ${customers.length}`);
    console.log(`- Total Bikes: ${bikes.length}`);
    console.log(`- Available Bikes: ${bikes.length - sales.length}`);
    console.log(`- Sold Bikes: ${sales.length}`);
    console.log(`- Total Sales: ${sales.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();