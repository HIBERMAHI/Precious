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
router.get("/ssales", issalesattendantOradmin, async (req, res) => {
  try {
    // 1. Fetch sales for the table
    const dbSales = await Sale.find()
      .populate("productName")
      .populate("attendant")
      .sort({ date: -1 });

    let stats = {
      salesRevenue: 0,
      transactions: 0,
      receipts: 0,
      itemsSold: 0,
    };

    // calculate total transactions
    const transAgg = await Sale.aggregate([{ $count: "total" }]);
    stats.transactions = transAgg.length > 0 ? transAgg[0].total : 0;

    // calculate total receipts
    const receiptsAgg = await Sale.aggregate([{ $count: "total" }]);
    stats.receipts = receiptsAgg.length > 0 ? receiptsAgg[0].total : 0;

    // calculate items sold
    const itemsSoldAgg = await Sale.aggregate([
      { $group: { _id: null, totalQty: { $sum: "$quantity" } } },
    ]);
    stats.itemsSold = itemsSoldAgg.length > 0 ? itemsSoldAgg[0].totalQty : 0;

    // calculate sales value
    const salesAgg = await Sale.aggregate([
      { $group: { _id: null, grandTotal: { $sum: "$totalAmount" } } },
    ]);
    stats.salesRevenue = salesAgg.length > 0 ? salesAgg[0].grandTotal : 0;

    res.render("ssales", { stats, dbSales });
  } catch (error) {
    console.error(error.message);
    res.status(404).send("Ooops stats not found");
  }
});

// getting data from data base to table and making sale
router.get("/newsale", issalesattendantOradmin, async (req, res) => {
  try {
    const items = await Stock.find({ quantity: { $gt: 0 } });
    const dbSales = await Sale.find()
      .populate("productName", "productName category")
      .populate("attendant", "fullname")
      .sort({ date: -1 });
    res.render("newsale", { items, dbSales });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Unable to pick sales from the data base");
  }
});

// making a sale

// making a sale
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
    if (parseInt(quantity) <= 0) {
      const items = await Stock.find({ quantity: { $gt: 0 } });
      const dbSales = await Sale.find()
        .populate("productName")
        .sort({ date: -1 });
      return res.render("newsale", {
        items,
        dbSales,
        error: "Error: Quantity must be 1 or more units.",
        oldData: req.body,
      });
    }
    // 1. Fetch the stock item immediately to check price and quantity
    const item = await Stock.findById(productName);

    // Friendly Helper function to re-render page with error
    const renderWithError = async (msg) => {
      const items = await Stock.find({ quantity: { $gt: 0 } });
      const dbSales = await Sale.find()
        .populate("productName", "productName category")
        .populate("attendant", "fullname")
        .sort({ date: -1 });
      return res.render("newsale", {
        items,
        dbSales,
        error: msg,
        oldData: req.body, // Keeps the form filled for the user
      });
    };

    if (!item) return res.status(404).send("Product not found in Stock");

    // 2. VALIDATION: Ugandan Phone Format
    // Replaced .startsWith with Regex to ensure only numbers are used
    const phoneRegex = /^(07[0-9]{8}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(phone)) {
      return renderWithError(
        "Invalid phone format. Use 07... (10 digits) or +256... (13 characters)",
      );
    }

    // 3. VALIDATION: Selling Price vs Buying Price (Profit Rule)
    if (parseFloat(price) <= parseInt(item.buyingPrice)) {
      return renderWithError(
        `Selling price must be higher than buying price (${item.buyingPrice} UGX)`,
      );
    }

    // 4. VALIDATION: Quantity Check
    if (item.quantity < parseInt(quantity)) {
      return renderWithError(
        `Error: You are trying to sell ${quantity}, but only ${item.quantity} are in stock.`,
      );
    }

    // 5. CALCULATIONS: Transport and Total
    const subTotal = parseInt(quantity) * parseFloat(price);

    let transportFee = 0;
    // Rule: Free delivery if <= 10km AND subTotal >= 500,000
    if (parseInt(distance) <= 10 && subTotal >= 500000) {
      transportFee = 0;
    } else {
      transportFee = 30000;
    }

    const totalAmount = subTotal + transportFee;

    // 6. SUCCESS: Clean phone, update stock, and save
    let cleanPhone = phone.replace(/\s/g, "");
    item.quantity -= parseInt(quantity);
    await item.save();

    const newsale = new Sale({
      customerName,
      phone: cleanPhone,
      productName,
      quantity,
      price,
      deliveryOption,
      distance,
      transportFee,
      paymentMethod,
      status: status || "completed",
      totalAmount,
      date,
      attendant: req.user._id,
    });

    await newsale.save();

    // 7. REDIRECT: Go straight to the receipt
    res.redirect(`/receipt/${newsale._id}`);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
});

// editing sale route (GET)
router.get("/sale/edit/:id", issalesattendantOradmin, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).send("Sale not found");
    res.render("saleedit", { sale });
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to load edit page");
  }
});

// deleting in sale file
router.post("/delete/:id", issalesattendantOradmin, async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.redirect("/newsale");
  } catch (error) {
    console.error(error);
    res.status(400).send("Error: Deleting sale");
  }
});

// updating sale (POST)

// updating sale (POST)
router.post("/sale/edit/:id", issalesattendantOradmin, async (req, res) => {
  try {
    const { customerName, phone, quantity, price, deliveryOption, distance } =
      req.body;

    // 1. Fetch current sale and stock item
    const sale = await Sale.findById(req.params.id);
    const item = await Stock.findById(sale.productName);

    if (!item) return res.status(404).send("Product not found in stock");

    // Helper for errors
    const renderEditError = (msg) => {
      return res.render("saleedit", {
        sale,
        error: msg,
      });
    };

    // 2. VALIDATION: Prevent Negative or Zero Quantity
    if (parseInt(quantity) <= 0) {
      return renderEditError("Error: Quantity must be 1 or more units.");
    }

    // 3. VALIDATION: Ugandan Phone Format
    const phoneRegex = /^(07[0-9]{8}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(phone)) {
      return renderEditError("Invalid phone format. Use 07... or +256...");
    }

    // 4. VALIDATION: Selling Price vs Buying Price (Profit Rule)
    if (parseFloat(price) <= parseInt(item.buyingPrice)) {
      return renderEditError(
        `Selling price must be higher than buying price (${item.buyingPrice} UGX)`,
      );
    }

    // 5. CALCULATIONS: Transport and Total
    const subTotal = parseInt(quantity) * parseFloat(price);

    let transportFee = 0;
    if (parseInt(distance) <= 10 && subTotal >= 500000) {
      transportFee = 0;
    } else {
      transportFee = 30000;
    }

    const totalAmount = subTotal + transportFee;

    // 6. SYNC STOCK: Adjust levels based on the edit
    const quantityDifference = parseInt(quantity) - sale.quantity;
    if (quantityDifference !== 0) {
      item.quantity -= quantityDifference;
      await item.save();
    }

    // 7. UPDATE DATABASE
    await Sale.findByIdAndUpdate(req.params.id, {
      customerName,
      phone,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      deliveryOption,
      transportFee,
      distance,
      totalAmount,
    });

    // 8. REDIRECT: To updated receipt
    res.redirect("/newsale");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Error updating sale");
  }
});

// receipt
// generating receipt
router.get("/receipt/:id", issalesattendantOradmin, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("productName") // CRITICAL: This allows #{sale.productName.productName} to work
      .populate("attendant", "fullname");

    if (!sale) return res.status(404).send("Receipt not found");

    res.render("receipt", { sale });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Receipt generation failed");
  }
});

// displaying stock in stckview page
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
