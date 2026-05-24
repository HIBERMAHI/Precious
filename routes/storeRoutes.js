const express = require("express");
const multer = require("multer");
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const Registration = require("../models/Registration");

const {
  issalesattendant,
  isadmin,
  isstoremanager,
  isstoremanagerOradmin,
  issalesattendantOradmin,
} = require("../middleware/auth");
const { transformAuthInfo } = require("passport");

// imge uploads
let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
let upload = multer({ storage: storage });

// store dashboard

router.get("/storedash", isstoremanagerOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find().sort({ createdAt: -1 });

    // Use these exact keys.
    // Check your Pug file to ensure it matches: #{stats.lowStock} and #{stats.enougthStock}
    let stats = {
      totalProducts: 0,
      lowStock: 0,
      enougthStock: 0,
      inventoryValue: 0,
    };

    // Calculate metrics
    const inventoryAgg = await Stock.aggregate([
      {
        $project: {
          currentValue: { $multiply: ["$quantity", "$buyingPrice"] },
        },
      },
      { $group: { _id: null, grandExpenditure: { $sum: "$currentValue" } } },
    ]);
    stats.inventoryValue =
      inventoryAgg.length > 0 ? inventoryAgg[0].grandExpenditure : 0;

    const totalAgg = await Stock.aggregate([
      { $group: { _id: null, grandProducts: { $sum: "$quantity" } } },
    ]);
    stats.totalProducts = totalAgg.length > 0 ? totalAgg[0].grandProducts : 0;

    // THE LOGIC:
    dbStock.forEach((item) => {
      // Ensure we treat the quantity as a number
      const qty = Number(item.quantity);

      if (qty <= 10) {
        stats.lowStock++;
      } else {
        stats.enougthStock++;
      }
    });

    // Send data to the view
    res.render("storedash", { dbStock, stats });
  } catch (error) {
    console.error("STOREDASH ERROR:", error.message);
    res.status(500).send("Unable to load data");
  }
});
// invento
// Updated INVENTO Route
router.get("/invento", isstoremanagerOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find().sort({ createdAt: -1 });

    // Initializing stats without the 'outOfStock' variable
    let stats = {
      totalProducts: 0,
      lowStock: 0,
      enougthStock: 0,
      inventoryValue: 0,
    };

    // 1. Calculate Inventory Value
    const inventoryAgg = await Stock.aggregate([
      {
        $project: {
          currentValue: { $multiply: ["$quantity", "$buyingPrice"] },
        },
      },
      { $group: { _id: null, grandExpenditure: { $sum: "$currentValue" } } },
    ]);
    stats.inventoryValue =
      inventoryAgg.length > 0 ? inventoryAgg[0].grandExpenditure : 0;

    // 2. Calculate Total Quantity
    const totalAgg = await Stock.aggregate([
      { $group: { _id: null, grandProducts: { $sum: "$quantity" } } },
    ]);
    stats.totalProducts = totalAgg.length > 0 ? totalAgg[0].grandProducts : 0;

    // 3. Logic: 10 and below = Low Stock, else Enough Stock
    dbStock.forEach((item) => {
      if (item.quantity <= 10) {
        stats.lowStock++;
      } else {
        stats.enougthStock++;
      }
    });

    res.render("invento", { dbStock, stats });
  } catch (error) {
    console.error("INVENTO ROUTE ERROR:", error.message);
    res.status(500).send("Unable to load inventory data");
  }
});

router.get("/stockin", (req, res) => {
  res.render("stockin");
});

router.get("/stockout", (req, res) => {
  res.render("stockout");
});

router.get("/storereports", (req, res) => {
  res.render("storereports");
});

router.get("/orders", (req, res) => {
  res.render("orders");
});

//  ADD STOCK
router.get("/addstock", isstoremanagerOradmin, (req, res) => {
  res.render("addstock");
});
// addstock

router.post(
  "/addstock",
  isstoremanagerOradmin,
  upload.single("itemImage"),
  async (req, res) => {
    try {
      const {
        productName,
        category,
        quantity,
        unit,
        buyingPrice,
        sellingPrice,
        paymentMethod,
        paymentStatus,
        factory,
        supplierName,
        supplierContact,
      } = req.body;

      // 1. TYPE CONVERSIONS
      const qty = Number(quantity);
      const buy = Number(buyingPrice);
      const sell = Number(sellingPrice);

      // 2. REQUIRED FIELDS VALIDATION
      if (
        !productName ||
        !category ||
        !quantity ||
        !buyingPrice ||
        !sellingPrice ||
        !supplierName ||
        !supplierContact
      ) {
        return res.render("addstock", {
          error:
            "Please fill all required fields, including Supplier Name and Contact.",
        });
      }

      // 3. NUMBER VALIDATION
      if (
        isNaN(qty) ||
        isNaN(buy) ||
        isNaN(sell) ||
        qty <= 0 ||
        buy <= 0 ||
        sell <= 0
      ) {
        return res.render("addstock", {
          error:
            "Quantities and prices must be valid numbers greater than zero.",
        });
      }

      // 4. BUSINESS LOGIC VALIDATION
      if (sell <= buy) {
        return res.render("addstock", {
          error: "Selling price must be greater than the buying price.",
        });
      }

      const total = qty * buy;
      const finalPaymentMethod = paymentMethod || "Cash";
      const finalPaymentStatus = paymentStatus === "Paid" ? "Paid" : "Pending";

      // 5. SAVE TO DATABASE
      const newStock = new Stock({
        productName,
        category,
        initialQuantity: qty,
        quantity: qty,
        unit,
        buyingPrice: buy,
        sellingPrice: sell,
        paymentMethod: finalPaymentMethod,
        paymentStatus: finalPaymentStatus,
        paymentBatchId: null, // Ensures new stock isn't attached to old payments
        factory,
        supplierName,
        supplierContact,
        total,
        itemImage: req.file ? req.file.path : null,
      });

      await newStock.save();
      return res.redirect("/invento");
    } catch (error) {
      console.error("ADDSTOCK ROUTE ERROR:", error.message);
      return res.render("addstock", {
        error: "Server error occurred: " + error.message,
      });
    }
  },
);

// EDIT STOCK
router.get("/stock/edit/:id", isstoremanagerOradmin, async (req, res) => {
  try {
    // Look up the specific item using the unique ID passed in the URL
    const stock = await Stock.findById(req.params.id);

    // If no record matches that ID, return a 404 error
    if (!stock) return res.status(404).send("Stock record not found");

    // Render your 'stockedit' Pug file and pass the stock data into it
    res.render("stockedit", { stock });
  } catch (error) {
    console.error("GET EDIT ROUTE ERROR:", error.message);
    res.status(404).send("Unable to locate specified stock element record");
  }
});
// edit stock
router.post(
  "/stock/edit/:id",
  isstoremanagerOradmin,
  upload.single("itemImage"),
  async (req, res) => {
    try {
      const {
        productName,
        category,
        quantity,
        unit,
        buyingPrice,
        sellingPrice,
        paymentMethod,
        factory,
        supplierName,
        supplierContact,
      } = req.body;

      const qty = Number(quantity);
      const buy = Number(buyingPrice);
      const sell = Number(sellingPrice);

      const stock = await Stock.findById(req.params.id);
      if (!stock) return res.status(404).send("Stock record not found");

      // Validate fields
      if (
        !productName ||
        !category ||
        !quantity ||
        !buyingPrice ||
        !sellingPrice ||
        !supplierName ||
        !supplierContact
      ) {
        return res.render("stockedit", {
          error: "All fields are required.",
          stock,
        });
      }

      // If refilling stock, we ensure the batchId is reset to null
      // so it doesn't try to link a new shipment to an old payment voucher.
      const updatedData = {
        productName,
        category,
        quantity: stock.quantity + qty,
        initialQuantity: stock.initialQuantity + qty,
        unit,
        buyingPrice: buy,
        sellingPrice: sell,
        paymentMethod,
        factory,
        supplierName,
        supplierContact,
        total: (stock.quantity + qty) * buy,
        // CRITICAL: If the stock was already "Paid",
        // a refill usually starts as "Pending" debt again.
        paymentStatus: qty > 0 ? "Pending" : stock.paymentStatus,
        paymentBatchId: qty > 0 ? null : stock.paymentBatchId,
      };

      if (req.file) {
        updatedData.itemImage = req.file.path;
      }

      await Stock.findByIdAndUpdate(req.params.id, updatedData);
      return res.redirect("/invento");
    } catch (error) {
      console.error("POST EDIT ROUTE ERROR:", error);
      const stock = await Stock.findById(req.params.id);
      return res.render("stockedit", { error: "Something went wrong.", stock });
    }
  },
);
// 5. DELETE ROUTE: Safely removes an item from stock records
router.post("/deleted/:id", isstoremanagerOradmin, async (req, res) => {
  try {
    await Stock.findByIdAndDelete(req.params.id);
    res.redirect("/invento");
  } catch (error) {
    console.error("DELETE ROUTE ERROR:", error.message);
    res.status(400).send("Error deleting stock item");
  }
});

// supplier
// supplier
router.get("/suppliers", isstoremanagerOradmin, async (req, res) => {
  try {
    // 1. Group ALL suppliers and include the factories they supply
    const supplierDebts = await Stock.aggregate([
      {
        $group: {
          _id: "$supplierName",
          contact: { $first: "$supplierContact" },
          productsSupplied: { $addToSet: "$productName" },
          // NEW: Collect unique factory names for this supplier
          factoriesSupplied: { $addToSet: "$factory" },
          // HOW: Use $cond to calculate debt only for "Pending" items
          totalDebt: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Pending"] }, "$total", 0],
            },
          },
        },
      },
      { $sort: { totalDebt: -1 } },
    ]);

    // 2. Stats: Calculate totals only for "Pending" items
    const statsResult = await Stock.aggregate([
      {
        $group: {
          _id: null,
          totalPendingDebt: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Pending"] }, "$total", 0],
            },
          },
          totalPendingQty: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Pending"] }, "$quantity", 0],
            },
          },
          totalPendingItems: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = statsResult[0] || {
      totalPendingDebt: 0,
      totalPendingQty: 0,
      totalPendingItems: 0,
    };

    res.render("suppliers", { supplierDebts, stats });
  } catch (error) {
    console.error("SUPPLIER ROUTE ERROR:", error.message);
    res.status(500).send("Unable to load supplier dashboard");
  }
});
router.post(
  "/pay-supplier/:supplierName",
  isstoremanagerOradmin,
  async (req, res) => {
    try {
      const supplierName = req.params.supplierName;
      // Generates a unique ID and captures the current timestamp at the moment of payment
      const batchId = Date.now().toString();
      const paymentTimestamp = new Date();

      // Updates only the currently "Pending" items and stamps them
      // with both the Batch ID and the exact Settlement Date
      await Stock.updateMany(
        { supplierName: supplierName, paymentStatus: "Pending" },
        {
          $set: {
            paymentStatus: "Paid",
            paymentBatchId: batchId,
            settlementDate: paymentTimestamp, // Save the date to the database
          },
        },
      );

      // Redirect to evidence showing ONLY this specific batch
      res.redirect(`/evidence/${supplierName}?batchId=${batchId}`);
    } catch (error) {
      console.error("PAYMENT ERROR:", error.message);
      res.status(500).send("Error updating payment status");
    }
  },
);
// GET: Generate the Evidence/Voucher
router.get(
  "/evidence/:supplierName",
  isstoremanagerOradmin,
  async (req, res) => {
    try {
      const supplierName = req.params.supplierName;

      // Find the most recent batch of paid items for this supplier
      // We filter for 'Paid' status so we don't accidentally pull pending items
      const lastPaidItem = await Stock.findOne({
        supplierName,
        paymentStatus: "Paid",
      }).sort({ settlementDate: -1 });

      if (!lastPaidItem) {
        return res.send("No payment history found for this supplier.");
      }

      const batchId = lastPaidItem.paymentBatchId;

      // IMPORTANT: This only fetches items from that specific payment event
      const items = await Stock.find({
        supplierName,
        paymentBatchId: batchId,
      });

      res.render("evidence", {
        items,
        supplierName,
        settlementDate: lastPaidItem.settlementDate,
        batchId,
      });
    } catch (error) {
      console.error("VOUCHER ROUTE ERROR:", error.message);
      res.status(500).send("Unable to load voucher");
    }
  },
);

module.exports = router;
