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

    let stats = {
      totalproducts: 0,
      lowStock: 0,
      EnougthStock: 0,
      inventoryValue: 0,
    };

    // 1. ADD STATUS LOGIC
    // We map over the dbStock to attach a status label to each item for the view
    const stockWithStatus = dbStock.map((item) => {
      let status = "Healthy";
      if (item.quantity <= 0) status = "Out of Stock";
      else if (item.quantity <= 10) status = "Low Stock";

      return {
        ...item.toObject(),
        status: status,
      };
    });

    // 2. CALCULATE METRICS (These use the live "quantity" field which reduces on sale)
    const totalAgg = await Stock.aggregate([
      { $group: { _id: null, grandProducts: { $sum: "$quantity" } } },
    ]);
    stats.totalproducts = totalAgg.length > 0 ? totalAgg[0].grandProducts : 0;

    const inventotryAgg = await Stock.aggregate([
      {
        $group: {
          _id: null,
          grandExpenditure: {
            $sum: { $multiply: ["$quantity", "$buyingPrice"] },
          },
        },
      },
    ]);
    stats.inventoryValue =
      inventotryAgg.length > 0 ? inventotryAgg[0].grandExpenditure : 0;

    // 3. COUNT THRESHOLDS
    stockWithStatus.forEach((item) => {
      if (item.quantity <= 10 && item.quantity > 0) stats.lowStock++;
      if (item.quantity > 10) stats.EnougthStock++;
    });

    // We pass 'stockWithStatus' instead of 'dbStock' to the view
    res.render("storedash", { dbStock: stockWithStatus, stats });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Unable to pick stock from the database");
  }
});

// storesales
router.get("/storsales", isstoremanagerOradmin, async (req, res) => {
  try {
    let stats = {
      salesRevenue: 0,
      itemsSold: 0,
    };

    // =====================================================
    // 1. REVENUE CALCULATOR (MULTI-ITEM LOGIC ENGINE)
    // Adds totalAmount and transportFee together to count all money
    // =====================================================
    const salesAgg = await Sale.aggregate([
      {
        $group: {
          _id: null,
          grandTotal: { $sum: { $add: ["$totalAmount", "$transportFee"] } },
        },
      },
    ]);
    stats.salesRevenue = salesAgg.length > 0 ? salesAgg[0].grandTotal : 0;

    // =====================================================
    // 2. ITEMS SOLD CALCULATOR (MULTI-ITEM LOGIC ENGINE)
    // Unwinds the items array sub-document rows to accurately count quantities
    // =====================================================
    const itemsAgg = await Sale.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          grandItems: { $sum: "$items.quantity" },
        },
      },
    ]);
    stats.itemsSold = itemsAgg.length > 0 ? itemsAgg[0].grandItems : 0;

    // =====================================================
    // 3. FETCH SALES DATABASE COLLECTION & POPULATION
    // deep populates items array and links attendant object fields
    // =====================================================
    const dbSales = await Sale.find()
      .populate({
        path: "items.productName",
        select: "productName",
      })
      .populate("attendant", "fullname")
      .sort({ date: -1 }); // Keeping sorting unified with your historical logs field

    // =====================================================
    // 4. RENDER VIEW TARGET ENGINE
    // =====================================================
    res.render("storsales", { dbSales, stats });
  } catch (error) {
    // Prints technical system crash traces to your developer console terminal window
    console.error("STORSALES ROUTE EXCEPTION:", error.message);
    res.status(404).send("Unable to pick sales from data base");
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
// =========================================================
// POST ROUTE: Processes the product-only stock entry form
// =========================================================
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
        paymentStatus, // This comes from your Pug form
        factory,
        supplierName,
        supplierContact,
      } = req.body;

      // Type Conversions
      const qty = Number(quantity);
      const buy = Number(buyingPrice);
      const sell = Number(sellingPrice);

      // Validation: Ensure all fields are filled
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

      // Validation: Ensure numbers are valid
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

      // Business Rule Validation
      if (sell <= buy) {
        return res.render("addstock", {
          error: "Selling price must be greater than the buying price.",
        });
      }

      const total = qty * buy;
      let finalPaymentMethod = paymentMethod || "Cash";

      // =========================================================
      // DATA SANITIZATION (The Fix for your Error)
      // Force the value to match your Schema ["Paid", "Pending"]
      // =========================================================
      let finalPaymentStatus = "Pending"; // Default
      if (paymentStatus === "Paid") {
        finalPaymentStatus = "Paid";
      } else {
        finalPaymentStatus = "Pending"; // Captures "Not paid" and turns it into "Pending"
      }

      // Save to Database
      const newStock = new Stock({
        productName,
        category,
        initialQuantity: qty,
        quantity: qty,
        unit,
        buyingPrice: buy,
        sellingPrice: sell,
        paymentMethod: finalPaymentMethod,
        paymentStatus: finalPaymentStatus, // Using the sanitized variable
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
// =========================================================
// 3. GET ROUTE: Fetches stock data to display in the edit form
// =========================================================
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
// EDIT STOCK POST ROUTE
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
        supplierName, // Added
        supplierContact, // Added
      } = req.body;

      const qty = Number(quantity);
      const buy = Number(buyingPrice);
      const sell = Number(sellingPrice);

      const stock = await Stock.findById(req.params.id);
      if (!stock) return res.status(404).send("Stock record not found");

      // Validate including new supplier fields
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
          error: "All fields including Supplier Name and Contact are required.",
          stock,
        });
      }

      // Logic: Update quantity and lifetime (Initial) total
      const updatedData = {
        productName,
        category,
        quantity: stock.quantity + qty,
        initialQuantity: stock.initialQuantity + qty, // Keeps lifetime audit
        unit,
        buyingPrice: buy,
        sellingPrice: sell,
        paymentMethod,
        factory,
        supplierName, // Added
        supplierContact, // Added
        total: (stock.quantity + qty) * buy,
      };

      if (req.file) {
        updatedData.itemImage = req.file.path;
      }

      await Stock.findByIdAndUpdate(req.params.id, updatedData);
      return res.redirect("/invento");
    } catch (error) {
      console.error("POST EDIT ROUTE ERROR:", error);
      const stock = await Stock.findById(req.params.id);
      return res.render("stockedit", {
        error: "Something went wrong while updating.",
        stock,
      });
    }
  },
);
// 5. DELETE ROUTE: Safely removes an item from stock records
// =========================================================
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
// GET: List all suppliers and their total debt + summary stats
router.get("/suppliers", isstoremanagerOradmin, async (req, res) => {
  try {
    // 1. Initialize stats object
    let stats = {
      totalPendingDebt: 0,
      totalPendingQty: 0,
      totalPendingItems: 0,
    };

    // 2. Fetch Supplier Table Data (The list for your table)
    const supplierDebts = await Stock.aggregate([
      { $match: { paymentStatus: "Pending" } },
      {
        $group: {
          _id: "$supplierName",
          totalDebt: { $sum: "$total" },
          itemsCount: { $sum: 1 },
          contact: { $first: "$supplierContact" },
          // Added product list logic
          productsSupplied: { $addToSet: "$productName" },
        },
      },
      { $sort: { totalDebt: -1 } },
    ]);

    // 3. Populate Stats: Total Debt (Grand Total)
    const debtAgg = await Stock.aggregate([
      { $match: { paymentStatus: "Pending" } },
      { $group: { _id: null, grandTotal: { $sum: "$total" } } },
    ]);
    stats.totalPendingDebt = debtAgg.length > 0 ? debtAgg[0].grandTotal : 0;

    // 4. Populate Stats: Total Quantity (Grand Total)
    const qtyAgg = await Stock.aggregate([
      { $match: { paymentStatus: "Pending" } },
      { $group: { _id: null, grandQty: { $sum: "$quantity" } } },
    ]);
    stats.totalPendingQty = qtyAgg.length > 0 ? qtyAgg[0].grandQty : 0;

    // 5. Populate Stats: Total Pending Items (Count)
    const itemsAgg = await Stock.aggregate([
      { $match: { paymentStatus: "Pending" } },
      { $count: "totalCount" },
    ]);
    stats.totalPendingItems = itemsAgg.length > 0 ? itemsAgg[0].totalCount : 0;

    // 6. Render the view with both the table data and the card stats
    res.render("suppliers", { supplierDebts, stats });
  } catch (error) {
    console.error("SUPPLIER ROUTE ERROR:", error.message);
    res.status(500).send("Unable to load supplier dashboard");
  }
});

// POST: Complete Payment for a specific supplier
router.post(
  "/pay-supplier/:supplierName",
  isstoremanagerOradmin,
  async (req, res) => {
    try {
      const supplierName = req.params.supplierName;

      // Updates all "Pending" items for this supplier to "Paid"
      await Stock.updateMany(
        { supplierName: supplierName, paymentStatus: "Pending" },
        { $set: { paymentStatus: "Paid" } },
      );

      // Redirect back to the dashboard to see the changes
      res.redirect("/suppliers");
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
      const items = await Stock.find({
        supplierName: req.params.supplierName,
        paymentStatus: "Paid",
      }).sort({ updatedAt: -1 });

      res.render("evidence", {
        supplierName: req.params.supplierName,
        items,
      });
    } catch (error) {
      console.error("EVIDENCE ERROR:", error.message);
      res.status(500).send("Unable to generate evidence");
    }
  },
);

module.exports = router;
