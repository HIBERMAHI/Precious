const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema({

  customerName: {
    type: String,
    trim: true,
  },

  phone: {
    type: String,
    required: true,
    match: [/^(?:\+256|07)[0-9]{8,9}$/, "please use the format +256XXXXXXXXX or 07XXXXXXXX"]
  },

  // =========================
  // MULTI ITEM SUPPORT (NEW)
  // =========================
  items: [
    {
      productName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Stock",
        required: true,
      },

      quantity: {
        type: Number,
        required: true,
      },

      price: {
        type: Number,
        required: true,
      },

      total: {
        type: Number,
        required: true,
      }
    }
  ],

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
    ref: "Registration",
  },

  date: {
    type: Date,
    default: Date.now,
  }

});

module.exports = mongoose.model("Sale", SaleSchema);