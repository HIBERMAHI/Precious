const express = require("express");
const multer = require("multer");
const router = express.Router();
const Stock = require("../models/Stock");

// ================= IMAGE UPLOADS =================
let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
let upload = multer({ storage: storage });

// ================= DASHBOARD ROUTES =================
router.get("/storedash", (req, res) => {
  res.render("storedash");
});

router.get("/storsales", (req, res) => {
  res.render("storsales");
});

router.get("/invento", async (req, res) => {
  try {
    const dbStock = await Stock.find();
    res.render("invento", { dbStock });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Unable to pick stock from the database");
  }
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

// ================= ADD STOCK =================
router.get("/addstock", (req, res) => {
  res.render("addstock");
});

router.post("/addstock", upload.single("itemImage"), async (req, res) => {
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

// ================= EDIT STOCK =================
router.get("/stock/edit/:id", async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).send("Stock not found");
    res.render("stockedit", { stock });
  } catch (error) {
    console.error(error.message);
    res.status(404).send("Unable to find stock");
  }
});

router.post("/stock/edit/:id", async (req, res) => {
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

// ================= DELETE STOCK =================
router.post("/deleted/:id", async (req, res) => {
  try {
    await Stock.findByIdAndDelete(req.params.id);
    res.redirect("/invento");
  } catch (error) {
    console.error(error.message);
    res.status(400).send("Error deleting stock");
  }
});

module.exports = router;
