const express = require("express");
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const {issalesattendant, isadmin,isstoremanager,isstoremanagerOradmin, issalesattendantOradmin } = require("../middleware/auth");

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
router.post("/newsale", issalesattendant, async (req, res) => {
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
      return res.status(404).send("Quantity is low");
    }
    item.quantity -= quantity;
    await item.save();
    let transportFee = 0;
    const distance = parseFloat(coverdDistance) || 0;
    if (deliveryOption === "delivery") {
      if (distance > 10) {
        transportFee = 30000;
      } else {
        transportFee = 0;
      }
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
// editing sale route
router.get("/sale/edit/:id", issalesattendantOradmin, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    res.render("saleedit", { sale });
    if (!sale) return res.status(404).send("Sale not found");
  } catch (error) {
    console.error(error);
    res.status(404).send("Unable to update");
  }
});
// deleting in sale file
router.post("/delete/:id", issalesattendantOradmin, async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.redirect("/newsale");
  } catch (error) {
    console.error(error);
    res.status(400).send("Eror: Deleting sale");
  }
});

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
      if (distance > 10) {
        transportFee = 30000;
      } else {
        transportFee = 0;
      }
    }
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
  }
});

// getting data to display in dashboard for recent sales
router.get("/ssales", issalesattendantOradmin, async (req, res) => {
  try {
    const dbSales = await Sale.find()
      .populate("productName", "productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });
    res.render("ssales", { dbSales });
  } catch (error) {
    console.error(error);
    res.status(404).send("Unable to pick sales from the data base");
  }
});

// router.get("/admindash", (req, res) => {
//   res.render("admindash");
// });

module.exports = router;
