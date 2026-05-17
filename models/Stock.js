const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      default: 0,
    },

    unit: {
      type: String,
      trim: true,
    },

    buyingPrice: {
      type: Number,
      required: true,
      default: 0,
    },

    sellingPrice: {
      type: Number,
      required: true,
      default: 0,
    },

    total: {
      type: Number,
      default: 0,
    },

    // =========================
    // PAYMENT FIELDS (NEW)
    // =========================

    paymentMethod: {
      type: String,
      enum: ["Cash", "Credit"],
      default: "Cash",
    },
    factory: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Partial", "Completed"],
      default: "Pending",
    },

    supplierName: {
      type: String,
      trim: true,
    },

    supplierContact: {
      type: String, // keep string for +256 / 07 formats
      trim: true,
    },

    deliveryDate: {
      type: Date,
      default: Date.now,
    },

    itemImage: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Stock", StockSchema);
