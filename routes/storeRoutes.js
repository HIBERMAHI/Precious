const express = require("express");
const router = express.Router();
const Stock = require("../models/Stock");

router.get("/storedash", (req, res) => {
  res.render("storedash");
});

router.get("/storsales", (req, res) => {
  res.render("storsales");
});
router.get("/invento", (req, res) => {
  res.render("invento");
});

router.get("/storereport", (req, res) => {
  res.render("storereport");
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

router.get("/addstock", (req, res) => {
  res.render("addstock");
});

router.post("/addstock", async (req, res) => {
  try {
    const {
      productName,
      category,
      quantity,
      unit,
      buyingPrice,
      sellingPrice,
      supplierName,
      supplierContact,
      deliveryDate,
    } = req.body;
    const total = parseInt(quantity) * parseFloat(sellingPrice);
    let newItem = new Stock({
      productName,
      category,
      quantity,
      unit,
      buyingPrice,
      sellingPrice,
      supplierName,
      supplierContact,
      total,
      deliveryDate,
    });
    console.log(newItem)
    await newItem.save();
    res.redirect('/')
  } catch (error) {
   res.render('/addstock',{error: error.message})
  }
});

module.exports = router;
