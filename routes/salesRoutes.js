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
    const dbSales = await Sale.find()
      .populate("items.productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });
    let stats = {
      salesRevenue: 0,
      transactions: 0,
      receipts: 0,
      itemsSold: 0,
    };
    const transAgg = await Sale.aggregate([{ $count: "total" }]);

    stats.transactions = transAgg.length > 0 ? transAgg[0].total : 0;

    const receiptsAgg = await Sale.aggregate([{ $count: "total" }]);

    stats.receipts = receiptsAgg.length > 0 ? receiptsAgg[0].total : 0;

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

    res.render("ssales", { stats, dbSales });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Ooops stats not found");
  }
});

router.get("/newsale", issalesattendantOradmin, async (req, res) => {
  try {
    // Pull active stock and deep populate items array for table log tracking
    const items = await Stock.find({
      quantity: { $gt: 0 },
      isRestockRecord: { $ne: true },
    });
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
    const products = Array.isArray(productName) ? productName : [productName];
    const quantities = Array.isArray(quantity) ? quantity : [quantity];
    const prices = Array.isArray(price) ? price : [price];

    // Phone Format Validation Check
    const phoneRegex = /^(07[0-9]{8}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(phone)) {
      const activeStocks = await Stock.find({
        quantity: { $gt: 0 },
        isRestockRecord: { $ne: true },
      });
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

    for (let i = 0; i < products.length; i++) {
      const stockItem = await Stock.findById(products[i]);

      if (!stockItem) {
        const activeStocks = await Stock.find({
          quantity: { $gt: 0 },
          isRestockRecord: { $ne: true },
        });
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
        const activeStocks = await Stock.find({
          quantity: { $gt: 0 },
          isRestockRecord: { $ne: true },
        });
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
        const activeStocks = await Stock.find({
          quantity: { $gt: 0 },
          isRestockRecord: { $ne: true },
        });
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
        const activeStocks = await Stock.find({
          quantity: { $gt: 0 },
          isRestockRecord: { $ne: true },
        });
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
    const productTotalSum = compiledItems.reduce(
      (sum, item) => sum + item.total,
      0,
    );
    const cleanDistance =
      distance === "" || distance === undefined ? 0 : parseInt(distance);

    let transportFee = 0;
    if (deliveryOption && deliveryOption.toLowerCase() === "delivery") {
      if (cleanDistance <= 10 && productTotalSum >= 500000) {
        transportFee = 0;
      } else {
        transportFee = 30000;
      }
    } else {
      transportFee = 0;
    }
    const totalAmount = productTotalSum;
    const newsale = new Sale({
      customerName,
      phone,
      items: compiledItems,
      deliveryOption: deliveryOption || "pickup",
      distance: deliveryOption === "delivery" ? cleanDistance : 0,
      paymentMethod,
      status: status || "completed",
      transportFee,
      totalAmount,
      date,
      attendant: req.user._id,
    });

    await newsale.save();

    for (const item of compiledItems) {
      await Stock.findByIdAndUpdate(item.productName, {
        $inc: { quantity: -item.quantity },
      });
    }

    return res.redirect(`/receipt/${newsale._id}`);
  } catch (error) {
    console.error("Sale Processing Error:", error);
    const activeStocks = await Stock.find({
      quantity: { $gt: 0 },
      isRestockRecord: { $ne: true },
    });
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
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).send("Sale not found");
    }
    for (const item of sale.items) {
      await Stock.findByIdAndUpdate(item.productName, {
        $inc: { quantity: item.quantity },
      });
    }
    await Sale.findByIdAndDelete(req.params.id);

    return res.redirect("/newsale");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error deleting sale");
  }
});
// updating sale
router.get("/sale/edit/:id", issalesattendantOradmin, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate(
      "items.productName",
    );

    if (!sale) {
      return res.status(404).send("Sale record not found");
    }
    const items = await Stock.find({ isRestockRecord: { $ne: true } });
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
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).send("Sale not found");

    const products = Array.isArray(productName) ? productName : [productName];
    const quantities = Array.isArray(quantity) ? quantity : [quantity];
    const prices = Array.isArray(price) ? price : [price];

    const phoneRegex = /^(07[0-9]{8}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(phone)) {
      return res.render("saleedit", {
        sale,
        error: "Invalid phone format. Use 07XXXXXXXX or +256XXXXXXXXX",
      });
    }
    for (const oldItem of sale.items) {
      await Stock.findByIdAndUpdate(oldItem.productName, {
        $inc: { quantity: oldItem.quantity },
      });
    }

    const updatedCompiledItems = [];
    for (let i = 0; i < products.length; i++) {
      const stockItem = await Stock.findById(products[i]);

      if (!stockItem) {
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
    for (const newItem of updatedCompiledItems) {
      await Stock.findByIdAndUpdate(newItem.productName, {
        $inc: { quantity: -newItem.quantity },
      });
    }
    const subTotal = updatedCompiledItems.reduce((sum, i) => sum + i.total, 0);
    const cleanDistance =
      distance === "" || distance === undefined ? 0 : parseInt(distance);

    let transportFee = 0;
    if (deliveryOption && deliveryOption.toLowerCase() === "delivery") {
      if (cleanDistance <= 10 && subTotal >= 500000) {
        transportFee = 0;
      } else {
        transportFee = 30000;
      }
    } else {
      transportFee = 0;
    }
    const totalAmount = subTotal;
    await Sale.findByIdAndUpdate(req.params.id, {
      customerName,
      phone,
      items: updatedCompiledItems,
      deliveryOption: deliveryOption || "pickup",
      distance: deliveryOption === "delivery" ? cleanDistance : 0,
      subTotal,
      transportFee,
      totalAmount,
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

router.get("/stockview", issalesattendantOradmin, async (req, res) => {
  try {
    const dbStock = await Stock.find({ isRestockRecord: { $ne: true } });
    res.render("stockview", { dbStock });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Unable to pick stock from the data base");
  }
});

// sales report
router.get("/weeklyReport", issalesattendantOradmin, async (req, res) => {
  try {
    // 1. Calculate the start of the week
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sales = await Sale.find({ date: { $gte: sevenDaysAgo } })
      .populate("items.productName", "productName")
      .populate("attendant", "fullname")
      .sort({ date: -1 });

    // 3. Calculate the total revenue for the entire week
    // We sum (totalAmount + transportFee) for every sale found
    const weekTotal = sales.reduce((sum, sale) => {
      const saleTotal = (sale.totalAmount || 0) + (sale.transportFee || 0);
      return sum + saleTotal;
    }, 0);

    // 4. Render the page, passing the full sales list and the grand total
    res.render("weeklyReport", {
      sales,
      weekTotal,
    });
  } catch (error) {
    console.error("Weekly Report Error:", error);
    res.status(500).send("Unable to generate the weekly sales report.");
  }
});
module.exports = router;
