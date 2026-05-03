const express = require("express");
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");

router.get("/credit", (req, res) => {
  res.render("credit");
});

router.post("/credit", (req, res) => {
  console.log(req.body);
});

router.get("/salesDash", (req, res) => {
  res.render("salesDash");
});

router.get("/saleshistory", (req, res) => {
  res.render("saleshistory");
});

// getting data from data base to table and making sale
router.get("/newsale", async (req, res) => {
  try {
    // const for making a sale
    const items = await Stock.find({
      quantity: { $gt: 0 },
    });
    // const for getting data from data base
    const dbSales = await Sale.find()
      .populate("productName", "productName category")
      .populate("attendant", "fullname")
      .sort({ date: -1 });
    res.render("newsale", { items, dbSales });
  } catch (error) {
    console.error(error.mesage);
    res.status(500).send("Unable to pick sales from the data base");
  }
});
// making a sale
router.post("/newsale", async (req, res) => {
  try {
    const {
      customerName,
      phone,
      productName,
      quantity,
      price,
      deliveryOption,
      distance,
      transportFee,
      paymentMethod,
      status,
      date,
    } = req.body;
    const item = await Stock.findById(productName);
    if (!item) return res.status(404).send("Item not found");
    if (item.quantity < quantity) {
      return res.status(404).send("Quantity is low");
    }
    item.quantity -= quantity;
    await item.save();
    const totalAmount = parseInt(quantity) * parseFloat(price);
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
      status,
      totalAmount,
      date,
      attendant: req.user._id,
    });
    console.log(newsale);
    await newsale
      .save()
      .then((result) => {
        console.log(result);
      })
      .catch((error) => {
        console.log(error);
      });
    res.redirect("/");
  } catch (error) {
    res.render("/newsale", (req, res) => {
      console.log(req.body);
    });
  }
});
// getting data to display in dashboard for recent sales
router.get("/ssales", async (req, res) => {
  try {
    const dbSales = await Sale.find()
      .populate("productName", "productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });
    res.render("ssales", { dbSales });
  } catch (error) {
    console.log(error);
    res.status(404).send("Unable to pick sales from the data base");
  }
});

router.get("/admindash", (req, res) => {
  res.render("admindash");
});

module.exports = router;
