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
    const dbStock = await Stock.find({
      isRestockRecord: { $ne: true },
    }).sort({ createdAt: -1 });
    // Use these exact keys.
    // Check your Pug file to ensure it matches: #{stats.lowStock} and #{stats.enougthStock}
    let stats = {
      totalProducts: 0,
      lowStock: 0,
      enougthStock: 0,
      inventoryValue: 0,
    };
    // Calculate available stock and stats using CURRENT stock (quantity + pendingQuantity)
    let totalCurrentQty = 0;
    let totalCurrentValue = 0;
    let lowStockCount = 0;
    let enoughStockCount = 0;

    const dbStockWithAvailable = dbStock.map((item) => {
      // Current available stock (what's in store now)
      const currentQty = Number(item.quantity);
      const currentValue = currentQty * Number(item.buyingPrice);

      // Add to totals for cards
      totalCurrentQty += currentQty;
      totalCurrentValue += currentValue;

      // Count low stock (1-100) vs enough stock (100+)
      if (currentQty > 0 && currentQty <= 100) {
        lowStockCount++;
      } else if (currentQty > 100) {
        enoughStockCount++;
      }

      return {
        ...item.toObject(),
        currentStock: currentQty,
      };
    });

    // Update stats cards with CURRENT values
    stats.totalProducts = totalCurrentQty;
    stats.inventoryValue = totalCurrentValue;
    stats.lowStock = lowStockCount;
    stats.enougthStock = enoughStockCount;

    // Send data to the view
    res.render("storedash", { dbStock: dbStockWithAvailable, stats });
  } catch (error) {
    console.error("STOREDASH ERROR:", error.message);
    res.status(500).send("Unable to load data");
  }
});
// invento
// Updated INVENTO Route
router.get("/invento", isstoremanagerOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find({
      isRestockRecord: { $ne: true },
    }).sort({ createdAt: -1 });

    // Initializing stats without the 'outOfStock' variable
    let stats = {
      totalProducts: 0,
      lowStock: 0,
      enougthStock: 0,
      inventoryValue: 0,
    };
    let lifetimeTotalQty = 0;
    let lowStockCount = 0;
    let enoughStockCount = 0;
    // 1. Calculate Inventory Value
    // INVENTO: Total money SPENT on all stock ever purchased (NEVER decreases)
    const inventoryAgg = await Stock.aggregate([
      { $match: { isRestockRecord: { $ne: true } } },
      { $group: { _id: null, grandExpenditure: { $sum: "$total" } } },
    ]);
    stats.inventoryValue =
      inventoryAgg.length > 0 ? inventoryAgg[0].grandExpenditure : 0;
    // 2. Calculate Total Quantity
    const totalAgg = await Stock.aggregate([
      { $match: { isRestockRecord: { $ne: true } } },
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
    // Calculate lifetime totals and current values
    dbStock.forEach((item) => {
      const lifetimeQty = Number(item.initialQuantity) || Number(item.quantity);
      const currentQty =
        Number(item.quantity) + Number(item.pendingQuantity || 0);
      const currentValue = currentQty * Number(item.buyingPrice);

      lifetimeTotalQty += lifetimeQty;

      if (currentQty > 0 && currentQty <= 100) {
        lowStockCount++;
      } else if (currentQty > 100) {
        enoughStockCount++;
      }
    });

    stats.totalProducts = lifetimeTotalQty;
    stats.lowStock = lowStockCount;
    stats.enougthStock = enoughStockCount;
    res.render("invento", { dbStock, stats });
  } catch (error) {
    console.error("INVENTO ROUTE ERROR:", error.message);
    res.status(500).send("Unable to load inventory data");
  }
});

router.get("/storereport", isstoremanagerOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find({
      isRestockRecord: { $ne: true },
    }).sort({ createdAt: -1 });

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
      { $match: { isRestockRecord: { $ne: true } } },
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
      { $match: { isRestockRecord: { $ne: true } } },
      {
        $project: { saleValue: { $multiply: ["$quantity", "$sellingPrice"] } },
      },
      { $group: { _id: null, grandSales: { $sum: "$saleValue" } } },
    ]);
    stats.totalSalesValue = salesAgg.length > 0 ? salesAgg[0].grandSales : 0;

    // 4. Calculate Total Quantity
    const totalAgg = await Stock.aggregate([
      { $match: { isRestockRecord: { $ne: true } } },
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
    const lowStockItems = await Stock.find({
      quantity: { $lte: 10 },
      isRestockRecord: { $ne: true },
    }).limit(5);
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
      const settlementDate = finalPaymentStatus === "Paid" ? new Date() : null;

      // Generate a unique ID for this specific delivery batch
      const generatedBatchId = Date.now().toString();
      // 5. CHECK IF PRODUCT EXISTS FIRST
      const existingProduct = await Stock.findOne({
        productName: productName,
        unit: unit,
        isRestockRecord: { $ne: true }, // Only check main products
      });

      if (existingProduct) {
        if (finalPaymentStatus === "Pending") {
          // ON CREDIT: Add to pendingQuantity, NOT main quantity
          existingProduct.pendingQuantity =
            (existingProduct.pendingQuantity || 0) + qty;
          await existingProduct.save();
        } else {
          // PAID: Add directly to main quantity
          existingProduct.quantity = existingProduct.quantity + qty;
          existingProduct.initialQuantity =
            existingProduct.initialQuantity + qty;
          existingProduct.total =
            existingProduct.quantity * existingProduct.buyingPrice;
          await existingProduct.save();
        }

        // Create supplier record for payment tracking
        const supplierRecord = new Stock({
          productName,
          category,
          initialQuantity: qty,
          quantity: qty,
          unit,
          buyingPrice: buy,
          sellingPrice: sell,
          paymentMethod: finalPaymentMethod,
          paymentStatus: finalPaymentStatus,
          settlementDate: settlementDate,
          paymentBatchId: generatedBatchId,
          factory,
          supplierName,
          supplierContact,
          total: qty * buy,
          itemImage: req.file ? req.file.path : null,
          isRestockRecord: true,
          parentStockId: existingProduct._id,
        });
        await supplierRecord.save();

        return res.redirect("/invento");
      }
      // 5. SAVE TO DATABASE for NEW product
      if (finalPaymentStatus === "Pending") {
        // CREDIT product
        const newStock = new Stock({
          productName,
          category,
          initialQuantity: qty,
          quantity: 0,
          pendingQuantity: qty,
          unit,
          buyingPrice: buy,
          sellingPrice: sell,
          paymentMethod: finalPaymentMethod,
          paymentStatus: finalPaymentStatus,
          settlementDate: settlementDate,
          paymentBatchId: generatedBatchId,
          factory,
          supplierName,
          supplierContact,
          total: qty * buy,
          itemImage: req.file ? req.file.path : null,
          isRestockRecord: false,
        });
        await newStock.save();

        // Create supplier record for payment tracking
        const supplierRecord = new Stock({
          productName,
          category,
          initialQuantity: qty,
          quantity: qty,
          unit,
          buyingPrice: buy,
          sellingPrice: sell,
          paymentMethod: finalPaymentMethod,
          paymentStatus: finalPaymentStatus,
          settlementDate: settlementDate,
          paymentBatchId: generatedBatchId,
          factory,
          supplierName,
          supplierContact,
          total: qty * buy,
          itemImage: req.file ? req.file.path : null,
          isRestockRecord: true,
          parentStockId: newStock._id,
        });
        await supplierRecord.save();
      } else {
        // PAID product
        const newStock = new Stock({
          productName,
          category,
          initialQuantity: qty,
          quantity: qty,
          pendingQuantity: 0,
          unit,
          buyingPrice: buy,
          sellingPrice: sell,
          paymentMethod: finalPaymentMethod,
          paymentStatus: finalPaymentStatus,
          settlementDate: settlementDate,
          paymentBatchId: generatedBatchId,
          factory,
          supplierName,
          supplierContact,
          total,
          itemImage: req.file ? req.file.path : null,
          isRestockRecord: false,
        });
        await newStock.save();
      }

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
        paymentStatus,
      } = req.body;

      const qty = Number(quantity);
      const buy = Number(buyingPrice);
      const sell = Number(sellingPrice);
      const finalPaymentMethod = paymentMethod || "Cash";
      const finalPaymentStatus =
        finalPaymentMethod === "Cash" ? "Paid" : paymentStatus;
      const settlementDate = finalPaymentStatus === "Paid" ? new Date() : null;

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
        paymentMethod: finalPaymentMethod,
        factory,
        supplierName,
        supplierContact,
        settlementDate: settlementDate,
        total: (stock.quantity + qty) * buy,
        paymentStatus: finalPaymentStatus,
        paymentBatchId: qty > 0 ? Date.now().toString() : stock.paymentBatchId,
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
    const productId = req.params.id;

    // Find the main product first
    const mainProduct = await Stock.findById(productId);

    if (!mainProduct) {
      return res.status(404).send("Stock record not found");
    }

    // 1. Delete ALL supplier records linked to this product
    //    (records where parentStockId matches this product's ID)
    const supplierDeleteResult = await Stock.deleteMany({
      parentStockId: productId,
      isRestockRecord: true,
    });

    // 2. Delete the main product itself
    await Stock.findByIdAndDelete(productId);

    console.log(`Deleted main product: ${mainProduct.productName}`);
    console.log(
      `Deleted ${supplierDeleteResult.deletedCount} linked supplier records`,
    );

    // 3. Redirect back to inventory page
    res.redirect("/invento");
  } catch (error) {
    console.error("DELETE ROUTE ERROR:", error.message);
    res.status(400).send("Error deleting stock item: " + error.message);
  }
});
// supplier
router.get("/suppliers", isstoremanagerOradmin, async (req, res) => {
  try {
    // 1. Group by Batch ID to keep every delivery as a separate row
    const supplierDebts = await Stock.aggregate([
      { $match: { isRestockRecord: true } },
      {
        $group: {
          _id: "$paymentBatchId",
          supplierName: { $first: "$supplierName" },
          contact: { $first: "$supplierContact" },
          productsSupplied: { $addToSet: "$productName" },
          factoriesSupplied: { $addToSet: "$factory" },
          totalDebt: { $sum: "$total" },
          quantity: { $sum: "$quantity" },
          pendingCount: {
            $sum: {
              $cond: [
                { $in: ["$paymentStatus", ["Pending", "Not paid"]] },
                1,
                0,
              ],
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
      {
        $match: {
          paymentStatus: { $in: ["Pending", "Not paid"] },
          isRestockRecord: true,
        },
      },

      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    stats.totalPendingDebt = debtAgg.length > 0 ? debtAgg[0].total : 0;

    // 4. Calculate Global Pending Quantity
    const qtyAgg = await Stock.aggregate([
      {
        $match: {
          paymentStatus: { $in: ["Pending", "Not paid"] },
          isRestockRecord: true,
        },
      },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);
    stats.totalPendingQty = qtyAgg.length > 0 ? qtyAgg[0].total : 0;

    // 5. Calculate Global Pending Items Count
    const countAgg = await Stock.aggregate([
      {
        $match: {
          paymentStatus: { $in: ["Pending", "Not paid"] },
          isRestockRecord: true,
        },
      },
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

      // Get all pending items in this batch
      const pendingItems = await Stock.find({
        supplierName: supplierName,
        paymentBatchId: batchId,
        paymentStatus: { $in: ["Pending", "Not paid"] },
      });

      if (pendingItems.length === 0) {
        return res.status(400).send("No pending records found for this batch.");
      }

      // For each pending item, move from pendingQuantity to main quantity
      for (const item of pendingItems) {
        const mainProduct = await Stock.findById(item.parentStockId);
        if (mainProduct) {
          mainProduct.quantity = mainProduct.quantity + item.quantity;
          mainProduct.initialQuantity =
            mainProduct.initialQuantity + item.quantity;
          mainProduct.total = mainProduct.quantity * mainProduct.buyingPrice;
          mainProduct.pendingQuantity = Math.max(
            0,
            (mainProduct.pendingQuantity || 0) - item.quantity,
          );

          // ========== FIX: Update payment status on main product ==========
          // This ensures the Inventory table, Store Dashboard, and Reports
          // all show "Paid" instead of "Pending" after payment
          mainProduct.paymentStatus = "Paid";
          mainProduct.settlementDate = new Date();
          // ========== END OF FIX ==========

          await mainProduct.save();
        }

        item.paymentStatus = "Paid";
        item.settlementDate = new Date();
        await item.save();
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

      const items = await Stock.find({
        supplierName: supplierName,
        paymentBatchId: batchId,
      });

      if (!items || items.length === 0) {
        return res.send("No records found for this batch.");
      }

      // NEW: Calculate the date.
      // Uses settlementDate if it exists (Paid/Credit), otherwise falls back to createdAt (Cash).
      const paymentDate = items[0].settlementDate || items[0].createdAt;

      // Pass the items, supplierName, AND the new paymentDate to the view
      res.render("evidence", {
        items,
        supplierName,
        paymentDate,
      });
    } catch (error) {
      console.error("VOUCHER ROUTE ERROR:", error.message);
      res.status(500).send("Unable to load voucher");
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

      const items = await Stock.find({
        supplierName: supplierName,
        paymentBatchId: batchId,
      });

      if (!items || items.length === 0) {
        return res.send("No records found for this batch.");
      }

      // NEW: Calculate the date.
      // Uses settlementDate if it exists (Paid/Credit), otherwise falls back to createdAt (Cash).
      const paymentDate = items[0].settlementDate || items[0].createdAt;

      // Pass the items, supplierName, AND the new paymentDate to the view
      res.render("evidence", {
        items,
        supplierName,
        paymentDate,
      });
    } catch (error) {
      console.error("VOUCHER ROUTE ERROR:", error.message);
      res.status(500).send("Unable to load voucher");
    }
  },
);
module.exports = router;
