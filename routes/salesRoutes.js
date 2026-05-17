const express = require("express");
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const {
  issalesattendant,
  isadmin,
  isstoremanager,
  isstoremanagerOradmin,
  issalesattendantOradmin,
} = require("../middleware/auth");
const { transformAuthInfo } = require("passport");

router.get("/credit", (req, res) => {
  res.render("credit");
});

router.post("/credit", (req, res) => {
  console.log(req.body);
});

router.get("/salesDash", (req, res) => {
  res.render("salesDash");
});

// salesdashboard ssales
// salesdashboard ssales
router.get("/ssales", issalesattendantOradmin, async (req, res) => {
  try {
    // =====================================================
    // 1. FETCH SALES (MULTI-ITEM FIXED POPULATE)
    // =====================================================
    const dbSales = await Sale.find()
      .populate("items.productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });

    // =====================================================
    // STATS OBJECT
    // =====================================================
    let stats = {
      salesRevenue: 0,
      transactions: 0,
      receipts: 0,
      itemsSold: 0,
    };

    // =====================================================
    // 2. TOTAL TRANSACTIONS
    // =====================================================
    const transAgg = await Sale.aggregate([{ $count: "total" }]);

    stats.transactions = transAgg.length > 0 ? transAgg[0].total : 0;

    // =====================================================
    // 3. TOTAL RECEIPTS
    // =====================================================
    const receiptsAgg = await Sale.aggregate([{ $count: "total" }]);

    stats.receipts = receiptsAgg.length > 0 ? receiptsAgg[0].total : 0;

    // =====================================================
    // 4. ITEMS SOLD (FIXED FOR MULTI-ITEM SCHEMA)
    // =====================================================
    const itemsSoldAgg = await Sale.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalQty: { $sum: "$items.quantity" },
        },
      },
    ]);

    stats.itemsSold = itemsSoldAgg.length > 0 ? itemsSoldAgg[0].totalQty : 0;

    // =====================================================
    // 5. SALES REVENUE (TOTAL AMOUNT)
    // =====================================================
    const salesAgg = await Sale.aggregate([
      {
        $group: {
          _id: null,
          grandTotal: { $sum: "$totalAmount" },
        },
      },
    ]);

    stats.salesRevenue = salesAgg.length > 0 ? salesAgg[0].grandTotal : 0;

    // =====================================================
    // 6. RENDER VIEW
    // =====================================================
    res.render("ssales", { stats, dbSales });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Ooops stats not found");
  }
});

// getting data from data base to table and making sale
// =====================================================
// GET NEW SALE FORM
// =====================================================
router.get("/newsale", issalesattendantOradmin, async (req, res) => {
  try {
    // Pull active stock and deep populate items array for table log tracking
    const items = await Stock.find({ quantity: { $gt: 0 } });
    const dbSales = await Sale.find()
      .populate("items.productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });

    // CHANGE: Kept payload structured as 'items' to seamlessly map with error states inside POST /newsale
    res.render("newsale", { items, dbSales });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Unable to pick sales from the data base");
  }
});
// making a sale
// =====================================================
// POST REGISTER NEW SALE (MULTI-ITEM WORKFLOW)
// =====================================================
// =====================================================
// POST REGISTER NEW SALE (MULTI-ITEM WORKFLOW)
// =====================================================
router.post("/newsale", issalesattendantOradmin, async (req, res) => {
  try {
    const {
      customerName,
      phone,
      productName,
      quantity,
      price,
      deliveryOption,
      distance,
      paymentMethod,
      status,
      date,
    } = req.body;

    // Force inputs into parallel arrays to support both single and multi-item rows safely
    const products = Array.isArray(productName) ? productName : [productName];
    const quantities = Array.isArray(quantity) ? quantity : [quantity];
    const prices = Array.isArray(price) ? price : [price];

    // 1. Phone Format Validation Check
    const phoneRegex = /^(07[0-9]{8}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(phone)) {
      const activeStocks = await Stock.find({ quantity: { $gt: 0 } });
      const dbSales = await Sale.find()
        .populate("items.productName")
        .populate("attendant", "fullname")
        .sort({ date: -1 });

      return res.render("newsale", {
        error: "Invalid phone format. Use 07XXXXXXXX or +256XXXXXXXXX",
        items: activeStocks,
        dbSales,
      });
    }

    const compiledItems = [];

    // 2. Loop through and validate every submitted product row
    for (let i = 0; i < products.length; i++) {
      const stockItem = await Stock.findById(products[i]);

      // Check if product exists in database
      if (!stockItem) {
        const activeStocks = await Stock.find({ quantity: { $gt: 0 } });
        const dbSales = await Sale.find()
          .populate("items.productName")
          .populate("attendant", "fullname")
          .sort({ date: -1 });

        return res.render("newsale", {
          error: "Product not found in stock",
          items: activeStocks,
          dbSales,
        });
      }

      const qty = parseInt(quantities[i]);
      const pr = parseFloat(prices[i]);

      // Quantity value check
      if (!qty || qty <= 0) {
        const activeStocks = await Stock.find({ quantity: { $gt: 0 } });
        const dbSales = await Sale.find()
          .populate("items.productName")
          .populate("attendant", "fullname")
          .sort({ date: -1 });

        return res.render("newsale", {
          error: "Quantity must be greater than 0",
          items: activeStocks,
          dbSales,
        });
      }

      // Inventory availability verification check
      if (stockItem.quantity < qty) {
        const activeStocks = await Stock.find({ quantity: { $gt: 0 } });
        const dbSales = await Sale.find()
          .populate("items.productName")
          .populate("attendant", "fullname")
          .sort({ date: -1 });

        return res.render("newsale", {
          error: `Not enough stock for ${stockItem.productName}. Available: ${stockItem.quantity}`,
          items: activeStocks,
          dbSales,
        });
      }

      // Financial margin protection validation check
      if (pr <= stockItem.buyingPrice) {
        const activeStocks = await Stock.find({ quantity: { $gt: 0 } });
        const dbSales = await Sale.find()
          .populate("items.productName")
          .populate("attendant", "fullname")
          .sort({ date: -1 });

        return res.render("newsale", {
          error: `Selling price for ${stockItem.productName} must be greater than its buying price (${stockItem.buyingPrice} UXG).`,
          items: activeStocks,
          dbSales,
        });
      }

      // Push mapped sub-document to compiling array list
      compiledItems.push({
        productName: stockItem._id,
        quantity: qty,
        price: pr,
        total: qty * pr,
      });
    }

    // 3. Process Products Value & Transport Fees
    // Calculates the combined sum total of all items ordered safely
    const productTotalSum = compiledItems.reduce((sum, item) => sum + item.total, 0);
    const dist = parseInt(distance) || 0;

    let transportFee = 0;
    if (deliveryOption && deliveryOption.toLowerCase() === "delivery") {
      // Free delivery tier: distance <= 10km AND products base sum total >= 500,000 UGX
      transportFee = dist <= 10 && productTotalSum >= 500000 ? 0 : 30000;
    } else {
      transportFee = 0;
    }

    // Grand final total calculated from items summary and delivery options
    const totalAmount = productTotalSum + transportFee;

    // 4. Create and Save the Master Sale Record
    const newsale = new Sale({
      customerName,
      phone,
      items: compiledItems,
      deliveryOption,
      distance: dist,
      paymentMethod,
      status: status || "completed",
      transportFee,
      totalAmount,
      date,
      attendant: req.user._id,
    });

    await newsale.save();

    // 5. Deduct Stock Levels across inventory collections safely
    for (const item of compiledItems) {
      await Stock.findByIdAndUpdate(item.productName, {
        $inc: { quantity: -item.quantity },
      });
    }

    return res.redirect(`/receipt/${newsale._id}`);
  } catch (error) {
    console.error("Sale Processing Error:", error);
    const activeStocks = await Stock.find({ quantity: { $gt: 0 } });
    const dbSales = await Sale.find()
      .populate("items.productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });

    return res.status(500).render("newsale", {
      error: "Something went wrong while processing the sale",
      items: activeStocks,
      dbSales,
    });
  }
});


// =====================================================
// POST REGISTER NEW SALE (MULTI-ITEM WORKFLOW)
// =====================================================

// making a sale

// =====================================================
// POST REGISTER NEW SALE (MULTI-ITEM WORKFLOW)
// =====================================================

// deleting sale
router.post("/delete/:id", issalesattendantOradmin, async (req, res) => {
  try {
    // =========================
    // FIND SALE FIRST
    // =========================
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).send("Sale not found");
    }

    // =========================
    // RESTORE STOCK BEFORE DELETE
    // =========================
    for (const item of sale.items) {
      await Stock.findByIdAndUpdate(item.productName, {
        $inc: { quantity: item.quantity },
      });
    }

    // =========================
    // DELETE SALE
    // =========================
    await Sale.findByIdAndDelete(req.params.id);

    return res.redirect("/newsale");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error deleting sale");
  }
});

// updating sale (POST)
// edit sale
// =====================================================
// GET EDIT SALE FORM (MISSING ROUTE FIXED)
// =====================================================
router.get("/sale/edit/:id", issalesattendantOradmin, async (req, res) => {
  try {
    // 1. Fetch the specific sale and populate its items
    const sale = await Sale.findById(req.params.id).populate(
      "items.productName",
    );

    if (!sale) {
      return res.status(404).send("Sale record not found");
    }

    // 2. Fetch all active stock items so the dropdowns have choices
    const items = await Stock.find();

    // 3. Render the edit page with both datasets
    res.render("saleedit", { sale, items });
  } catch (error) {
    console.error("Error loading edit page:", error.message);
    res.status(500).send("Internal server error loading edit interface");
  }
});

// updating sale (POST)
// =====================================================
// POST UPDATE SALE DATA (FIXED MULTI-ITEM STOCK ENGINE)

// =====================================================
// POST UPDATE SALE DATA (FIXED MULTI-ITEM STOCK ENGINE)
// =====================================================
router.post("/sale/edit/:id", issalesattendantOradmin, async (req, res) => {
  try {
    const {
      customerName,
      phone,
      productName,
      quantity,
      price,
      deliveryOption,
      distance,
    } = req.body;

    // Fetch the original sale document from the database
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).send("Sale not found");

    // Force inputs into parallel arrays to support single or multiple entries safely
    const products = Array.isArray(productName) ? productName : [productName];
    const quantities = Array.isArray(quantity) ? quantity : [quantity];
    const prices = Array.isArray(price) ? price : [price];

    // Phone Format Validation Check
    const phoneRegex = /^(07[0-9]{8}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(phone)) {
      return res.render("saleedit", {
        sale,
        error: "Invalid phone format. Use 07XXXXXXXX or +256XXXXXXXXX",
      });
    }

    // STEP 1: Temporarily restore old stock to accurately verify edits
    for (const oldItem of sale.items) {
      await Stock.findByIdAndUpdate(oldItem.productName, {
        $inc: { quantity: oldItem.quantity },
      });
    }

    const updatedCompiledItems = [];

    // STEP 2: Loop and validate new modifications against the restored stock pool
    for (let i = 0; i < products.length; i++) {
      const stockItem = await Stock.findById(products[i]);

      if (!stockItem) {
        await rollbackStockEdits(sale.items);
        return res.render("saleedit", {
          sale,
          error: "Product not found in stock database",
        });
      }

      const qty = parseInt(quantities[i]);
      const pr = parseFloat(prices[i]);

      if (!qty || qty <= 0) {
        await rollbackStockEdits(sale.items);
        return res.render("saleedit", {
          sale,
          error: "Quantity must be greater than 0",
        });
      }

      // Check current item availability
      if (stockItem.quantity < qty) {
        await rollbackStockEdits(sale.items);
        return res.render("saleedit", {
          sale,
          error: `Not enough stock for ${stockItem.productName}. Max available with current invoice: ${stockItem.quantity}`,
        });
      }

      // Financial profit check (selling price vs buying price)
      if (pr <= stockItem.buyingPrice) {
        await rollbackStockEdits(sale.items);
        return res.render("saleedit", {
          sale,
          error: `Selling price for ${stockItem.productName} must be higher than its buying price (${stockItem.buyingPrice} UGX).`,
        });
      }

      updatedCompiledItems.push({
        productName: stockItem._id,
        quantity: qty,
        price: pr,
        total: qty * pr,
      });
    }

    // STEP 3: Validation passed successfully. Deduct the newly specified quantities
    for (const newItem of updatedCompiledItems) {
      await Stock.findByIdAndUpdate(newItem.productName, {
        $inc: { quantity: -newItem.quantity },
      });
    }

    // Re-calculate Subtotals and Transport Fees
    const subTotal = updatedCompiledItems.reduce((sum, i) => sum + i.total, 0);
    const dist = parseInt(distance) || 0;

    // Evaluate deliveryOption string values correctly
    let transportFee = 0;
    if (deliveryOption && deliveryOption.toLowerCase() === "delivery") {
      // Free delivery tier: distance <= 10km AND items value >= 500,000 UGX
      transportFee = dist <= 10 && subTotal >= 500000 ? 0 : 30000;
    } else {
      // Automatic zero charge if pickup or undefined
      transportFee = 0;
    }

    // Grand total configuration
    const totalAmount = subTotal + transportFee;

    // STEP 4: Update the Sale collection record with clean totals
    await Sale.findByIdAndUpdate(req.params.id, {
      customerName,
      phone,
      items: updatedCompiledItems,
      deliveryOption,
      distance: dist,
      subTotal, // Saved cleanly to handle split fields on frontend view engines
      transportFee,
      totalAmount,
    });

    return res.redirect("/newsale");
  } catch (error) {
    console.error("Sale Update Error:", error);
    return res.status(500).render("saleedit", {
      error: "Error updating sale records. Try again.",
    });
  }
});
// =====================================================
// POST UPDATE SALE DATA (FIXED MULTI-ITEM STOCK ENGINE)
// =====================================================

// receipt

// =====================================================
// GET PRINT INVOICE RECEIPT (MULTI-ITEM POPULATE)
// =====================================================
router.get("/receipt/:id", issalesattendantOradmin, async (req, res) => {
  try {
    // CHANGE: Reconfigured population syntax to extract properties inside the deep sub-document array layout
    const sale = await Sale.findById(req.params.id)
      .populate({
        path: "items.productName",
        select: "productName store branch genericName",
      })
      .populate("attendant", "fullname");

    if (!sale) {
      return res.status(404).send("Receipt not found");
    }

    res.render("receipt", { sale });
  } catch (error) {
    console.error("Receipt Generation Error:", error.message);
    res.status(500).send("Receipt generation failed internally");
  }
});
// =====================================================
// GET PRINT INVOICE RECEIPT (MULTI-ITEM POPULATE)
// =====================================================

// displaying stock in stckview page
// =====================================================
// GET INVENTORY VIEWER (STOCKVIEW)
// =====================================================
router.get("/stockview", issalesattendantOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find();
    res.render("stockview", { dbStock });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Unable to pick stock from the data base");
  }
});
module.exports = router;
