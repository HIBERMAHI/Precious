const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema({
  productName: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    trim: true,
  },
  quantity: {
    type: Number,
  },
  unit: {
    type: String,
    trim: true,
  },
  buyingPrice: {
    type: Number,
  },
  sellingPrice: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
  },
  supplierName: {
    type: String,
    trim: true,
  },
  supplierContact: {
    type: Number,
  },
  deliveryDate: {
    type: Date,
  },
});

module.exports = mongoose.model("Stock", StockSchema);
