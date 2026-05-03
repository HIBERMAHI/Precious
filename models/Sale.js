const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema({
  customerName: {
    type: String,
    trim: true,
  },
  phone: {
    type: Number,
  },
  productName: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  deliveryOption: {
    type: String,
    trim: true,
  },
  distance: {
    type: Number,
  },
  transportFee: {
    type: Number,
  },
  paymentMethod: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    trim: true,
  },
  totalAmount: {
    type: Number,
  },
  attendant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
  },
  date:{
    type: Date,
    default:Date.now
  }
});

module.exports = mongoose.model("Sale", SaleSchema);
