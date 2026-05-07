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

router.get("/credit", (req, res) => {
  res.render("credit");
});

router.post("/credit", (req, res) => {
  console.log(req.body);
});

router.get("/salesDash", (req, res) => {
  res.render("salesDash");
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
router.post("/newsale", issalesattendantOradmin, async (req, res) => {
  try {
    const {
      customerName,
      phone,
      productName,
      quantity,
      price,
      deliveryOption,
      distance: coverdDistance,
      paymentMethod,
      status,
      date,
    } = req.body;

    const item = await Stock.findById(productName);
    if (!item) return res.status(404).send("Item not found");
    
    if (item.quantity < quantity) {
      return res.status(400).send("Quantity is low");
    }

    // Modern Await: Update Stock
    item.quantity -= quantity;
    await item.save();

    let transportFee = 0;
    const distance = parseFloat(coverdDistance) || 0;
    if (deliveryOption === "delivery") {
      transportFee = distance > 10 ? 30000 : 0;
    }

    const totalAmount = parseInt(quantity) * parseFloat(price) + transportFee;

    const newsale = new Sale({
      customerName,
      phone,
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

    // Modern Await: Save Sale (Removed .then/.catch)
    await newsale.save();
    
    res.redirect("/newsale"); // Redirected back to sales page
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
router.post("/sale/edit/:id", issalesattendantOradmin, async (req, res) => {
  try {
    const {
      customerName,
      phone,
      quantity,
      price,
      deliveryOption,
      distance: coveredDistance,
    } = req.body;

    const distance = parseFloat(coveredDistance) || 0;
    let transportFee = 0;
    if (deliveryOption === "delivery") {
      transportFee = distance > 10 ? 30000 : 0;
    }

    // Fixed: Using price from req.body instead of undefined item.price
    const totalAmount = parseInt(quantity) * parseFloat(price) + transportFee;

    await Sale.findByIdAndUpdate(req.params.id, {
      customerName,
      phone,
      quantity,
      price,
      deliveryOption,
      transportFee,
      distance,
      totalAmount,
    });

    res.redirect("/newsale");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Error updating sale");
  }
});

// generating receipt (Fixed URL parameter and population fields)
router.get('/receipt/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('productName', 'productName')
      .populate('attendant', 'fullname'); // Fixed typo from 'fullNmae'
    
    if (!sale) return res.status(404).send('Receipt not found');
    res.render('receipt', { sale });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Receipt generation failed');
  }
});

// getting data to display in dashboard
router.get("/ssales", issalesattendantOradmin, async (req, res) => {
  try {
    const dbSales = await Sale.find()
      .populate("productName", "productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });
    res.render("ssales", { dbSales });
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to pick sales from the data base");
  }
});

module.exports = router;