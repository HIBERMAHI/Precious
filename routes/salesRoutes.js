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
      distance,
      paymentMethod,
      status,
      date,
    } = req.body;

    const item = await Stock.findById(productName);
    if (!item) return res.status(404).send("Item not found");

    if (item.quantity < quantity) {
      return res.status(400).send("Quantity is low");
    }
    const totalAmount = parseInt(quantity) * parseFloat(price)
    let transportFee = 0
    if(distance <=10 && totalAmount >=500000){
      transportFee = 0
    } else{
      transportFee = 30000
    }
    let cleanPhone = phone.replace(/\s/g, "");
    if (!cleanPhone.startsWith("+")) {
      cleanPhone = "+" + cleanPhone;
    }
    // Modern Await: Update Stock
    item.quantity -= quantity;
    await item.save();
    const newsale = new Sale({
      customerName,
      phone:cleanPhone,
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

    res.redirect(`/receipt/${newsale._id}`); // Redirected back to sales page
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
    const { customerName, phone, quantity, price, deliveryOption, distance } =
      req.body;


    const totalAmount = parseInt(quantity) * parseFloat(price);

    let transportFee = 0;
    if (distance <= 10 && totalAmount >= 500000) {
      transportFee = 0;
    } else {
      transportFee = 30000;
    }

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
router.get("/receipt/:id",issalesattendantOradmin, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("productName", "productName")
      .populate("attendant", "fullname"); // Fixed typo from 'fullNmae'

    if (!sale) return res.status(404).send("Receipt not found");
    res.render("receipt", { sale });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Receipt generation failed");
  }
});

// getting data to display in dashboard
router.get("/ssales", issalesattendantOradmin, async (req, res) => {
  try {
    let stats = {
      salesRevenue:0,
      itemsSold:0,
      transactions:0,
      receipts:0,
    };
    const salesAgg = await Sale.aggregate(
      [{$group: {_id:null, grandTotal: {$sum:'$totalAmount'}}},]
    );
    stats.salesRevenue = salesAgg.length >0? salesAgg[0].grandTotal:0;
    const itemsAgg = await Sale.aggregate(
      [{$group:{_id:null,grandItems:{$sum:'$quantity'}}},]
    );
    stats.itemsSold = itemsAgg.length>0? itemsAgg[0].grandItems:0;
    const transactionsAgg = await Sale.aggregate(
      [{$group: {_id:null,grandTransactions: {$sum:1}}},]
    );
    stats.transactions = transactionsAgg.length>0?transactionsAgg[0].grandTransactions:0;
    const receiptsAgg = await Sale.aggregate(
     [ {$group:{_id:null,grandReceipts: {$sum:1}}},]
    );
    stats.receipts = receiptsAgg.length>0?receiptsAgg[0].grandReceipts:0;
    // displaying cards on dashboard
    const dbSales = await Sale.find()
      .populate("productName", "productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });
    res.render("ssales", { dbSales , stats});
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to pick sales from the data base");
  }
});

// displaying stock in stckview page
router.get('/stockview', issalesattendantOradmin,async (req,res)=>{
try {
  const dbStock = await Stock.find();
  res.render('stockview', {dbStock});
} catch (error) {
  console.error(error.message)
  res.status(500).send('Unable to pick stock from the data base')
}
})
module.exports = router;
