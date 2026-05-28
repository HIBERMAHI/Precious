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

      if (qty <= 100) {
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
      if (item.quantity <= 100) {
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

router.get("/storereport", isstoremanagerOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find().sort({ createdAt: -1 });

    // 1. Initializing stats exactly like your Invento format
    let stats = {
      totalInventoryValue: 0,
      totalSalesValue: 0,
      totalStockCount: 0,
      pendingDebt: 0,
      potentialProfit: 0,
    };

    // 2. Calculate Inventory Value (Buying Price)
    const inventoryAgg = await Stock.aggregate([
      {
        $project: {
          currentValue: { $multiply: ["$quantity", "$buyingPrice"] },
        },
      },
      { $group: { _id: null, grandExpenditure: { $sum: "$currentValue" } } },
    ]);
    stats.totalInventoryValue =
      inventoryAgg.length > 0 ? inventoryAgg[0].grandExpenditure : 0;

    // 3. Calculate Total Sales Value (Selling Price)
    const salesAgg = await Stock.aggregate([
      {
        $project: { saleValue: { $multiply: ["$quantity", "$sellingPrice"] } },
      },
      { $group: { _id: null, grandSales: { $sum: "$saleValue" } } },
    ]);
    stats.totalSalesValue = salesAgg.length > 0 ? salesAgg[0].grandSales : 0;

    // 4. Calculate Total Quantity
    const totalAgg = await Stock.aggregate([
      { $group: { _id: null, grandProducts: { $sum: "$quantity" } } },
    ]);
    stats.totalStockCount = totalAgg.length > 0 ? totalAgg[0].grandProducts : 0;

    // 5. Calculate Pending Debt
    const debtAgg = await Stock.aggregate([
      { $match: { paymentStatus: "Pending" } },
      { $group: { _id: null, totalDebt: { $sum: "$total" } } },
    ]);
    stats.pendingDebt = debtAgg.length > 0 ? debtAgg[0].totalDebt : 0;

    // 6. Calculate Potential Profit
    stats.potentialProfit = stats.totalSalesValue - stats.totalInventoryValue;

    // 7. Low Stock items (for the list in the report)
    const lowStockItems = await Stock.find({ quantity: { $lte: 10 } }).limit(5);

    // 8. Render the report
    // Note: Ensure your Pug file is named 'storereports.pug' to match this
    res.render("storereport", {
      inventory: dbStock,
      stats,
      lowStockItems,
      reportDate: new Date().toLocaleDateString(),
    });
  } catch (error) {
    console.error("STOREREPORT ERROR:", error.message);
    res.status(500).send("Unable to load report data");
  }
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
      const finalPaymentStatus =
        finalPaymentMethod === "Cash" ? "Paid" : paymentStatus;

      // Generate a unique ID for this specific delivery batch
      const generatedBatchId = Date.now().toString();

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
        // Assign the unique batch ID so this delivery is isolated
        paymentBatchId: generatedBatchId,
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
    // 1. Group by Batch ID to keep every delivery as a separate row
    const supplierDebts = await Stock.aggregate([
      {
        $group: {
          _id: "$paymentBatchId",
          supplierName: { $first: "$supplierName" },
          contact: { $first: "$supplierContact" },
          productsSupplied: { $addToSet: "$productName" },
          factoriesSupplied: { $addToSet: "$factory" },
          totalDebt: { $sum: "$total" },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Pending"] }, 1, 0],
            },
          },
          paymentBatchId: { $first: "$paymentBatchId" },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    // 2. Initialize the stats object
    let stats = {
      totalPendingDebt: 0,
      totalPendingQty: 0,
      totalPendingItems: 0,
    };

    // 3. Calculate Global Pending Debt
    const debtAgg = await Stock.aggregate([
      { $match: { paymentStatus: "Pending" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    stats.totalPendingDebt = debtAgg.length > 0 ? debtAgg[0].total : 0;

    // 4. Calculate Global Pending Quantity
    const qtyAgg = await Stock.aggregate([
      { $match: { paymentStatus: "Pending" } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);
    stats.totalPendingQty = qtyAgg.length > 0 ? qtyAgg[0].total : 0;

    // 5. Calculate Global Pending Items Count
    const countAgg = await Stock.aggregate([
      { $match: { paymentStatus: "Pending" } },
      { $count: "total" },
    ]);
    stats.totalPendingItems = countAgg.length > 0 ? countAgg[0].total : 0;

    res.render("suppliers", { supplierDebts, stats });
  } catch (error) {
    console.error("SUPPLIER ROUTE ERROR:", error.message);
    res.status(500).send("Unable to load supplier dashboard");
  }
});
// supplier
router.post(
  "/pay-supplier/:supplierName",
  isstoremanagerOradmin,
  async (req, res) => {
    try {
      const { supplierName } = req.params;
      // Convert to string explicitly to ensure it matches the database schema
      const batchId = String(req.body.batchId);

      // We removed the 'paymentStatus: "Pending"' filter.
      // Now, this route will find ALL items in the batch.
      // It sets them to 'Paid' and updates the 'settlementDate' to the exact moment of this action.
      const result = await Stock.updateMany(
        {
          supplierName: supplierName,
          paymentBatchId: batchId,
        },
        {
          $set: {
            paymentStatus: "Paid",
            settlementDate: new Date(), // Captures the exact moment payment is finalized
          },
        },
      );

      // matchedCount checks if the query found the batch at all
      if (result.matchedCount === 0) {
        return res
          .status(400)
          .send("No records found for this batch. Check your Batch ID.");
      }

      // Redirect to evidence showing ONLY this specific batch
      res.redirect(`/evidence/${supplierName}?batchId=${batchId}`);
    } catch (error) {
      console.error("PAYMENT ERROR:", error.message);
      res.status(500).send("Error updating payment status: " + error.message);
    }
  },
);

// GET: Generate the Evidence/Voucher
router.get(
  "/evidence/:supplierName",
  isstoremanagerOradmin,
  async (req, res) => {
    try {
      const { supplierName } = req.params;
      const { batchId } = req.query;

      // Fetch items belonging to this batch regardless of status
      const items = await Stock.find({
        supplierName: supplierName,
        paymentBatchId: batchId,
      });

      if (!items || items.length === 0) {
        return res.send("No records found for this batch.");
      }

      // Pass the items array to the view
      res.render("evidence", {
        items,
        supplierName,
      });
    } catch (error) {
      console.error("VOUCHER ROUTE ERROR:", error.message);
      res.status(500).send("Unable to load voucher");
    }
  },
);
module.exports = router;
