const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema({
  productName: {
    type: String,
    trim: true,
    required: true
  },
  category: {
    type: String,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    trim: true,
  },
  buyingPrice: {
    type: Number,
    required: true,
    default: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    default: 0,
    validate:{
      validator: function(value){
        return value > this.buyingPrice;
      },
      message:"Sellingprice ({value})  must be greator than buyingPrice"
    }
  },
  
  total: {
    type: Number,
    default: 0
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
    default: Date.now,
  },
  itemImage: {
    type: String,
  }
});


module.exports = mongoose.model("Stock", StockSchema);
