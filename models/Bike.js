const mongoose = require('mongoose');

const bikeSchema = new mongoose.Schema({
  bikeNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  brand: {
    type: String,
    required: true,
    enum: ['Honda', 'Yamaha', 'Bajaj', 'TVS', 'Hero', 'KTM', 'Royal Enfield', 'Suzuki', 'Kawasaki']
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true,
    min: 1990,
    max: new Date().getFullYear() + 1
  },
  buyPrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellPrice: {
    type: Number,
    default: null
  },
  profit: {
    type: Number,
    default: null
  },
  profitPercent: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['available', 'sold', 'reserved'],
    default: 'available'
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  sellDate: {
    type: Date,
    default: null
  },
  daysToSell: {
    type: Number,
    default: null
  },
  color: {
    type: String,
    trim: true
  },
  fuelType: {
    type: String,
    enum: ['Petrol', 'Electric'],
    default: 'Petrol'
  },
  mileage: {
    type: Number,
    min: 0
  },
  engineCC: {
    type: Number,
    min: 0
  },
  conditionRating: {
    type: Number,
    min: 1,
    max: 10,
    default: 8
  },
  notes: {
    type: String,
    trim: true
  },
  images: [{
    type: String
  }],
  documents: {
    license: {
      fileName: String,
      filePath: String,
      uploadDate: { type: Date, default: Date.now }
    },
    pollution: {
      fileName: String,
      filePath: String,
      uploadDate: { type: Date, default: Date.now }
    },
    model: {
      fileName: String,
      filePath: String,
      uploadDate: { type: Date, default: Date.now }
    }
  },
  documentStatus: {
    type: String,
    enum: ['complete', 'incomplete', 'pending'],
    default: 'incomplete'
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    default: null
  }
}, {
  timestamps: true
});

// Calculate profit when sellPrice is set
bikeSchema.pre('save', function(next) {
  if (this.sellPrice && this.buyPrice) {
    this.profit = this.sellPrice - this.buyPrice;
    this.profitPercent = (this.profit / this.buyPrice) * 100;
  }
  
  if (this.sellDate && this.purchaseDate) {
    const timeDiff = this.sellDate.getTime() - this.purchaseDate.getTime();
    this.daysToSell = Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
  
  next();
});

// Indexes for better performance
bikeSchema.index({ bikeNumber: 1 });
bikeSchema.index({ brand: 1, model: 1 });
bikeSchema.index({ status: 1 });
bikeSchema.index({ purchaseDate: 1 });

module.exports = mongoose.model('Bike', bikeSchema);