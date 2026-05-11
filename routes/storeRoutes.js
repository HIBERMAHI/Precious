const express = require("express");
const multer = require("multer");
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
router.get("/storedash",isstoremanagerOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find();
    let stats = {
      totalproducts: 0,
      lowStock: 0,
      EnougthStock: 0,
      inventoryValue: 0,
    };
    const totalAgg = await Stock.aggregate([
      { $group: { _id: null, grandProducts: { $sum: "$quantity" } } },
    ]);
    stats.totalproducts = totalAgg.length > 0 ? totalAgg[0].grandProducts : 0;
    const lowstock = 10;
    dbStock.forEach((item) => {
      if (item.quantity <= lowstock && item.quantity > 0) {
        stats.lowStock++;
      }
      if (item.quantity > lowstock) {
        stats.EnougthStock++;
      }
    });
    const inventotryAgg = await Stock.aggregate([
      { $group: { _id: null, grandExpenditure: { $sum: "$total" } } },
    ]);
    stats.inventoryValue =
      inventotryAgg.length > 0 ? inventotryAgg[0].grandExpenditure : 0;
    // displaying content on storedash cards
    res.render("storedash", { dbStock, stats });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Unable to pick stock from the data base");
  }
});

router.get("/storsales",isstoremanagerOradmin, async (req, res) => {
  try {
    let stats = {
      salesRevenue:0,
      itemsSold:0,
    };
    const salesAgg= await Sale.aggregate(
      [{$group: {_id:null, grandTotal: {$sum:'$totalAmount'}}},]
    );
    stats.salesRevenue = salesAgg.length > 0? salesAgg[0].grandTotal:0;
    const itemsAgg = await Sale.aggregate(
      [{$group: {_id:null, grandItems: {$sum : '$quantity'}}},]
    );
    stats.itemsSold = itemsAgg.length>0 ?itemsAgg[0].grandItems:0;
    const dbSales = await Sale.find()
      .populate("productName", "productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });
    res.render("storsales", { dbSales, stats });
  } catch (error) {
    console.error(error.message);
    res.status(404).send("Unable to pick sales from data base");
  }
});

router.get("/invento",isstoremanagerOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find();
    let stats = {
      totalProducts: 0,
      lowStock: 0,
      enougthStock: 0,
      inventoryValue: 0,
    };
    const totalAgg = await Stock.aggregate([
      { $group: { _id: null, grandProducts: { $sum: "$quantity" } } },
    ]);
    stats.totalProducts = totalAgg.length > 0 ? totalAgg[0].grandProducts : 0;
    const lowStock = 10;
    dbStock.forEach((item) => {
      if (item.quantity <= lowStock && item.quantity > 0) {
        stats.lowStock++;
      }
      if (item.quantity > lowStock) {
        stats.enougthStock++;
      }
    });
    const inventoryAgg = await Stock.aggregate([
      { $group: { _id: null, grandExpenditure: { $sum: "$total" } } },
    ]);
    stats.inventoryValue =
      inventoryAgg.length > 0 ? inventoryAgg[0].grandExpenditure : 0;
    res.render("invento", { dbStock, stats });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Unable to pick stock from the database");
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
router.get("/addstock",isstoremanagerOradmin, (req, res) => {
  res.render("addstock");
});

router.post("/addstock", isstoremanagerOradmin, upload.single("itemImage"), async (req, res) => {
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
    const qty = Number(quantity) || 0;
    const buy = Number(buyingPrice) || 0;
    const sell = Number(sellingPrice) || 0;
    if (buy <= 0 || sell <= 0 || qty <= 0) {
      return res.render("addstock", {
        error: "Prices and quantity must be greater than zero.",
        formData: req.body,
      });
    }
    if (sell <= buy) {
      return res.render("addstock", {
        error: `selling price (${sell}) cannot be less than buying price (${buy})`,
        formData: req.body,
      });
    }
    const total = qty * buy;
    let newItem = new Stock({
      productName,
      category,
      quantity: qty,
      unit,
      buyingPrice: buy,
      sellingPrice: sell,
      supplierName,
      supplierContact,
      deliveryDate,
      total,
      itemImage: req.file ? req.file.path : null,
    });

    await newItem.save();
    res.redirect("/invento");
  } catch (error) {
    console.error(error.message);
    res.render("addstock", { error: error.message });
  }
});

// EDIT STOCK
router.get("/stock/edit/:id",issalesattendantOradmin, async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).send("Stock not found");
    res.render("stockedit", { stock });
  } catch (error) {
    console.error(error.message);
    res.status(404).send("Unable to find stock");
  }
});

router.post("/stock/edit/:id",isstoremanagerOradmin, async (req, res) => {
  try {
    const {
      category,
      quantity,
      unit,
      buyingPrice,
      sellingPrice,
      supplierName,
      supplierContact,
    } = req.body;
    const qty = Number(quantity) || 0;
    const buy = Number(buyingPrice) || 0;
    const sell = Number(sellingPrice) || 0;
    const total = qty * buy;
    if (buy <= 0 || sell <= 0 || qty <= 0) {
      const stock = await Stock.findById(req.params.id);
      return res.render("stockedit", {
        error: "prices and quantity must be greater than zero.",
        stock: { ...req.body, _id: req.params.id },
      });
    }
    if (sell <= buy) {
      const stock = await Stock.findById(req.params.id);
      return res.render("stockedit", {
        error: `Selling price (${sell}) cannot be less than or equal to buying price (${buy})`,
        stock: { ...req.body, _id: req.params.id },
      });
    }
    await Stock.findByIdAndUpdate(req.params.id, {
      category,
      quantity: qty,
      unit,
      buyingPrice: buy,
      sellingPrice: sell,
      supplierName,
      supplierContact,
      total,
    });

    res.redirect("/invento");
  } catch (error) {
    console.error(error.message);
    res.status(400).send("Error updating stock");
  }
});

// DELETE STOCK 
router.post("/deleted/:id", isstoremanagerOradmin,async (req, res) => {
  try {
    await Stock.findByIdAndDelete(req.params.id);
    res.redirect("/invento");
  } catch (error) {
    console.error(error.message);
    res.status(400).send("Error deleting stock");
  }
});

module.exports = router;
