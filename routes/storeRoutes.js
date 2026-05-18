const express = require("express");
const multer = require("multer");
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const Registration = require("../models/Registration");

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
    const dbStock = await Stock.find().sort({ createdAt: -1 });
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

// storesales
router.get("/storsales", isstoremanagerOradmin, async (req, res) => {
  try {
    let stats = {
      salesRevenue: 0,
      itemsSold: 0,
    };

    // =====================================================
    // 1. REVENUE CALCULATOR (MULTI-ITEM LOGIC ENGINE)
    // Adds totalAmount and transportFee together to count all money
    // =====================================================
    const salesAgg = await Sale.aggregate([
      {
        $group: {
          _id: null,
          grandTotal: { $sum: { $add: ["$totalAmount", "$transportFee"] } },
        },
      },
    ]);
    stats.salesRevenue = salesAgg.length > 0 ? salesAgg[0].grandTotal : 0;

    // =====================================================
    // 2. ITEMS SOLD CALCULATOR (MULTI-ITEM LOGIC ENGINE)
    // Unwinds the items array sub-document rows to accurately count quantities
    // =====================================================
    const itemsAgg = await Sale.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          grandItems: { $sum: "$items.quantity" },
        },
      },
    ]);
    stats.itemsSold = itemsAgg.length > 0 ? itemsAgg[0].grandItems : 0;

    // =====================================================
    // 3. FETCH SALES DATABASE COLLECTION & POPULATION
    // deep populates items array and links attendant object fields
    // =====================================================
    const dbSales = await Sale.find()
      .populate({
        path: "items.productName",
        select: "productName",
      })
      .populate("attendant", "fullname")
      .sort({ date: -1 }); // Keeping sorting unified with your historical logs field

    // =====================================================
    // 4. RENDER VIEW TARGET ENGINE
    // =====================================================
    res.render("storsales", { dbSales, stats });
  } catch (error) {
    // Prints technical system crash traces to your developer console terminal window
    console.error("STORSALES ROUTE EXCEPTION:", error.message);
    res.status(404).send("Unable to pick sales from data base");
  }
});

router.get("/invento",isstoremanagerOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find().sort({ createdAt: -1 });;
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
// addstock
router.post(
  "/addstock",
  isstoremanagerOradmin,
  upload.single("itemImage"),
  async (req, res) => {
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
        paymentMethod,
        paymentStatus,
        factory,
      } = req.body;

      // =========================
      // TYPE CONVERSION
      // =========================
      const qty = Number(quantity);
      const buy = Number(buyingPrice);
      const sell = Number(sellingPrice);

      // =========================
      // REQUIRED FIELD VALIDATION
      // =========================
      if (
        !productName ||
        !category ||
        !quantity ||
        !buyingPrice ||
        !sellingPrice
      ) {
        return res.render("addstock", {
          error: "Please fill all required fields",
        });
      }

      // =========================
      // NUMBER VALIDATION
      // =========================
      if (isNaN(qty) || isNaN(buy) || isNaN(sell)) {
        return res.render("addstock", {
          error: "Quantity and prices must be valid numbers",
        });
      }

      if (qty <= 0 || buy <= 0 || sell <= 0) {
        return res.render("addstock", {
          error: "Quantity and prices must be greater than zero",
        });
      }

      // =========================
      // BUSINESS RULE
      // =========================
      if (sell <= buy) {
        return res.render("addstock", {
          error:
            "Selling price must be greater than buying price",
        });
      }

      // =========================
      // PHONE VALIDATION
      // =========================
      if (
        supplierContact &&
        !/^(07\d{8}|\+256\d{9})$/.test(supplierContact)
      ) {
        return res.render("addstock", {
          error:
            "Phone must be 07XXXXXXXX or +256XXXXXXXXX",
        });
      }

      // =========================
      // AUTO CALCULATIONS
      // =========================
      const total = qty * buy;

      // =========================
      // PAYMENT LOGIC (AUTO SAFE)
      // =========================
      let finalPaymentMethod = paymentMethod || "Cash";
      let finalPaymentStatus = paymentStatus || "Pending";

      // =========================
      // CREATE STOCK
      // =========================
      const newStock = new Stock({
        productName,
        category,
        quantity: qty,
        unit,
        buyingPrice: buy,
        sellingPrice: sell,
        supplierName,
        supplierContact,
        deliveryDate,
        factory,
        paymentMethod: finalPaymentMethod,
        paymentStatus: finalPaymentStatus,
        total,
        itemImage: req.file ? req.file.path : null,
      });

      await newStock.save();

      return res.redirect("/invento");
    } catch (error) {
      console.error(error.message);

      return res.render("addstock", {
        error: "Server error while saving stock",
      });
    }
  }
);



// EDIT STOCK
router.get("/stock/edit/:id",isstoremanagerOradmin, async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).send("Stock not found");
    res.render("stockedit", { stock });
  } catch (error) {
    console.error(error.message);
    res.status(404).send("Unable to find stock");
  }
});

// edit stock
router.post("/stock/edit/:id", isstoremanagerOradmin, upload.single("itemImage"), async (req, res) => {
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
      paymentMethod,
      paymentStatus,
      factory,
    } = req.body;

    const qty = Number(quantity);
    const buy = Number(buyingPrice);
    const sell = Number(sellingPrice);

    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).send("Stock not found");

    // ✅ VALIDATION SAFE (NO CRASH)
    if (!category || !quantity || !buyingPrice || !sellingPrice) {
      return res.render("stockedit", {
        error: "Category, quantity and prices are required",
        stock
      });
    }

    if (isNaN(qty) || isNaN(buy) || isNaN(sell)) {
      return res.render("stockedit", {
        error: "Prices and quantity must be numbers",
        stock
      });
    }

    if (qty <= 0 || buy <= 0 || sell <= 0) {
      return res.render("stockedit", {
        error: "Values must be greater than zero",
        stock
      });
    }

    if (sell <= buy) {
      return res.render("stockedit", {
        error: "Selling price must be greater than buying price",
        stock
      });
    }

    // phone validation
    if (
      supplierContact &&
      !/^(07\d{8}|\+256\d{9})$/.test(supplierContact)
    ) {
      return res.render("stockedit", {
        error: "Invalid phone number format",
        stock
      });
    }

    const updatedData = {
      category,
      quantity: qty,
      unit,
      buyingPrice: buy,
      sellingPrice: sell,
      supplierName,
      supplierContact,
      deliveryDate,
      paymentMethod,
      paymentStatus,
      factory,
      total: qty * buy,
    };

    // ✅ only update image if new one uploaded
    if (req.file) {
      updatedData.itemImage = req.file.path;
    }

    await Stock.findByIdAndUpdate(req.params.id, updatedData);

    return res.redirect("/invento");

  } catch (error) {
    console.error(error);

    const stock = await Stock.findById(req.params.id);

    return res.render("stockedit", {
      error: "Something went wrong while updating stock",
      stock
    });
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
