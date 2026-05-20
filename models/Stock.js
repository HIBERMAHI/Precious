const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    // This value is captured at entry and remains static for history
    initialQuantity: {
      type: Number,
      required: [true, "Initial delivery quantity is required"],
      min: [1, "Initial quantity cannot be less than 1"],
    },
    // This is the active stock that your sale routes will decrement
    quantity: {
      type: Number,
      required: [true, "Current quantity is required"],
      min: [0, "Quantity cannot be less than 0"],
    },
    unit: {
      type: String,
      trim: true,
    },
    buyingPrice: {
      type: Number,
      required: [true, "Buying price is required"],
      min: [0, "Buying price cannot be negative"],
    },
    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price cannot be negative"],
    },
    total: {
      type: Number,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Credit"],
      default: "Cash",
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Pending",
    },
    factory: {
      type: String,
      trim: true,
    },
    supplierName: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
    },
    paymentBatchId: { type: String, default: null },
    supplierContact: {
      type: String,
      required: [true, "Supplier contact number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return /^(\+256\d{9}|07\d{8})$/.test(v);
        },
        message: "Invalid contact format.",
      },
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
