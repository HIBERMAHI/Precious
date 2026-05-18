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
      // This tells MongoDB to add totalAmount and transportFee together for each sale, 
      // and then calculate the grand sum of all sales.
      grandTotal: { $sum: { $add: ["$totalAmount", "$transportFee"] } },
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
// making a sale  post route
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

    // 1. Force inputs into parallel arrays to support both single and multi-item rows safely
    const products = Array.isArray(productName) ? productName : [productName];
    const quantities = Array.isArray(quantity) ? quantity : [quantity];
    const prices = Array.isArray(price) ? price : [price];

    // Phone Format Validation Check
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

      compiledItems.push({
        productName: stockItem._id,
        quantity: qty,
        price: pr,
        total: qty * pr,
      });
    }

    // =====================================================
    // 3. FIXED TRANSPORT ENGINE (FORCED CHARGE LOGIC)
    // =====================================================
    const productTotalSum = compiledItems.reduce(
      (sum, item) => sum + item.total,
      0,
    );
    const cleanDistance =
      distance === "" || distance === undefined ? 0 : parseInt(distance);

    let transportFee = 0;

    // FIRST LEVEL CHECK: Are they asking for Delivery?
    if (deliveryOption && deliveryOption.toLowerCase() === "delivery") {
      // SECOND LEVEL CHECK: Do they qualify for the free tier?
      if (cleanDistance <= 10 && productTotalSum >= 500000) {
        transportFee = 0; // Within 10km AND >= 500k -> FREE
      } else {
        transportFee = 30000; // ELSE -> Force the 30,000 shs charge!
      }
    } else {
      // If it's a Pickup order, transport is ALWAYS 0 shs regardless of distance/amount
      transportFee = 0;
    }

    // Keep totalAmount strictly for product costs so Pug can add them cleanly
    const totalAmount = productTotalSum;

    // =====================================================
    // 4. CREATE AND SAVE THE RECORD
    // =====================================================
    const newsale = new Sale({
      customerName,
      phone,
      items: compiledItems,
      deliveryOption: deliveryOption || "pickup",
      distance: deliveryOption === "delivery" ? cleanDistance : 0,
      paymentMethod,
      status: status || "completed",
      transportFee, // Saves 0 or 30000 based on the rule check above
      totalAmount, // Raw item cost subtotal
      date,
      attendant: req.user._id,
    });

    await newsale.save();

    // 5. Deduct Stock Levels safely
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
      error: "Something went wrong processing the sale",
      items: activeStocks,
      dbSales,
    });
  }
});

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
        // Simple mock function check / direct array fallback inline to keep code running
        for (const oldItem of sale.items) {
          await Stock.findByIdAndUpdate(oldItem.productName, {
            $inc: { quantity: -oldItem.quantity },
          });
        }
        return res.render("saleedit", {
          sale,
          error: "Product not found in stock database",
        });
      }

      const qty = parseInt(quantities[i]);
      const pr = parseFloat(prices[i]);

      if (!qty || qty <= 0) {
        for (const oldItem of sale.items) {
          await Stock.findByIdAndUpdate(oldItem.productName, {
            $inc: { quantity: -oldItem.quantity },
          });
        }
        return res.render("saleedit", {
          sale,
          error: "Quantity must be greater than 0",
        });
      }

      if (stockItem.quantity < qty) {
        for (const oldItem of sale.items) {
          await Stock.findByIdAndUpdate(oldItem.productName, {
            $inc: { quantity: -oldItem.quantity },
          });
        }
        return res.render("saleedit", {
          sale,
          error: `Not enough stock for ${stockItem.productName}. Max available with current invoice: ${stockItem.quantity}`,
        });
      }

      if (pr <= stockItem.buyingPrice) {
        for (const oldItem of sale.items) {
          await Stock.findByIdAndUpdate(oldItem.productName, {
            $inc: { quantity: -oldItem.quantity },
          });
        }
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

    // =====================================================
    // THE EXACT FIXED TRANSPORT LOGIC ENGINE
    // =====================================================
    const subTotal = updatedCompiledItems.reduce((sum, i) => sum + i.total, 0);
    const cleanDistance =
      distance === "" || distance === undefined ? 0 : parseInt(distance);

    let transportFee = 0;

    // Check delivery type selection
    if (deliveryOption && deliveryOption.toLowerCase() === "delivery") {
      // Evaluate strict free eligibility threshold
      if (cleanDistance <= 10 && subTotal >= 500000) {
        transportFee = 0; // Free Tier criteria achieved
      } else {
        transportFee = 30000; // Condition unfulfilled -> Force standard 30,000 UGX
      }
    } else {
      transportFee = 0; // Baseline zero charge fallback for self-pickups
    }

    // CRITICAL CORRECTION: totalAmount is now kept strictly as Product Costs Only.
    // It no longer blends subTotal + transportFee together here!
    const totalAmount = subTotal;

    // STEP 4: Update the Sale collection record with clean split variables
    await Sale.findByIdAndUpdate(req.params.id, {
      customerName,
      phone,
      items: updatedCompiledItems,
      deliveryOption: deliveryOption || "pickup",
      distance: deliveryOption === "delivery" ? cleanDistance : 0,
      subTotal,
      transportFee, // 0 or 30000
      totalAmount, // Products Only Total
    });

    return res.redirect("/newsale");
  } catch (error) {
    console.error("Sale Update Error:", error);
    return res.status(500).render("saleedit", {
      error: "Error updating sale records. Try again.",
    });
  }
});
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
