const express = require("express");
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const Regicredit = require("../models/Regicredit");
const Deposit = require("../models/Deposit");
const Registration = require("../models/Registration");
const { isadmin } = require("../middleware/auth");

// ==========================================
// 1. Dashboard Stats Route (CORRECTED)
router.get("/admindash", async (req, res) => {
  try {
    const dbusers = await Registration.find();
    let stats = {
      salesRevenue: 0,
      inventoryValue: 0,
      depositsCollected: 0,
      pendingBalance: 0,
    };
    // calc total sales reve
    const salesAgg = await Sale.aggregate([
      { $group: { _id: null, grandTotal: { $sum: "$totalAmount" } } },
    ]);
    stats.salesRevenue = salesAgg.length > 0 ? salesAgg[0].grandTotal : 0;
    // calculate inventory value
    const inventoryAgg = await Stock.aggregate([
      { $group: { _id: null, grandExpenditure: { $sum: "$total" } } },
    ]);
    stats.inventoryValue =
      inventoryAgg.length > 0 ? inventoryAgg[0].grandExpenditure : 0;
    //   calc deposits
    const depositsCollectedAgg = await Deposit.aggregate([
      { $group: { _id: null, deposits: { $sum: "$initialDeposit" } } },
    ]);
    stats.depositsCollected =
      depositsCollectedAgg.length > 0 ? depositsCollectedAgg[0].deposits : 0;

    //   balances
    const pendingBalanceAgg = await Deposit.aggregate([
      { $group: { _id: null, balance: { $sum: "$balance" } } },
    ]);
    stats.pendingBalance =
      pendingBalanceAgg.length > 0 ? pendingBalanceAgg[0].balance : 0;
    res.render("admindash", { stats, dbusers });
  } catch (error) {
    console.error(error.message);
    res.status(404).send("Ooops stats not found");
  }
});

// 2. Credit Customer Registration (GET)
router.get("/regicredit", isadmin, async (req, res) => {
  try {
    const customers = await Regicredit.find().sort({ _id: -1 });;
    res.render("regicredit", { customers });
  } catch (error) {
    console.error(error.mesage);
    res.status(400).send("Oooops customers not found");
  }
});

// 3. Credit Customer Registration (POST) - FIXED VALIDATION & SYNTAX

router.post("/regicredit", async (req, res) => {
  const {
    fullName,
    nin,
    phoneNumber,
    address,
    distanceFromStore,
    email,
    password,
  } = req.body;

  try {
    // 1. Email Validation (Matching your Model Regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render("regicredit", {
        error: "Enter a valid email address.",
      });
    }

    // 2. NIN Validation (Matching your Model Regex)
    const cleanNIN = nin.toUpperCase().trim();
    const ninRegex = /^[A-Z0-9]{14}$/;
    if (!ninRegex.test(cleanNIN)) {
      return res.render("regicredit", {
        error: "NIN must be exactly 14 uppercase letters and numbers.",
      });
    }

    // 3. Password Validation
    if (!password || password.length < 6) {
      return res.render("regicredit", {
        error: "Password must be at least 6 characters long.",
      });
    }

    // 4. Phone Formatting (Ensuring it matches your +256\d{9} or 07\d{8} requirement)
    let cleanPhone = phoneNumber.replace(/\s+/g, "");
    if (cleanPhone.startsWith("0")) {
      // Converts 0772123456 to +256772123456 (matching the 13-char model requirement)
      cleanPhone = "+256" + cleanPhone.substring(1);
    }

    // 5. Database Save
    const newCustomer = new Regicredit({
      fullName,
      nin: cleanNIN,
      phoneNumber: cleanPhone,
      address,
      distanceFromStore: Number(distanceFromStore), // Model expects a Number
      email: email.toLowerCase().trim(),
    });

    // Passport handles the hashing and unique 'email' check
    await Regicredit.register(newCustomer, password);
    res.redirect("/deposit");
  } catch (error) {
    console.error(error);

    // Catch specific Mongoose errors (like unique constraint on NIN)
    if (error.code === 11000) {
      return res.render("regicredit", {
        error: "NIN or Email already exists.",
        // user: req.body,
      });
    }

    if (error.name === "UserExistsError") {
      return res.render("regicredit", {
        error: "This email is already registered.",
        // user: req.body,
      });
    }

    res.render("regicredit", {
      error: "Registration failed: " + error.message,
      // user: req.body,
    });
  }
});

// editing and deleting regicredit

router.get("/credit/edit/:id", async (req, res) => {
  try {
    // Use 'Regicredit' because that is what you imported at the top
    const customer = await Regicredit.findById(req.params.id);
    res.render("editcredit", { customer, error: req.query.error });
  } catch (error) {
    res.redirect("/regicredit?error=Customer+not+found");
  }
});

router.post('/credit/update/:id', async (req, res) => {
    try {
        const { fullName, phoneNumber, address, distanceFromStore, password } = req.body;

        // Validation: Ensure password length matches your rules
        if (password.length < 6 || password.length > 14) {
            return res.redirect(`/credit/edit/${req.params.id}?error=Password+must+be+6-14+characters`);
        }

        await Regicredit.findByIdAndUpdate(req.params.id, {
            fullName,
            phoneNumber,
            address,
            distanceFromStore
        });

        res.redirect('/regicredit'); // Return to table after success
    } catch (err) {
        res.redirect(`/credit/edit/${req.params.id}?error=Update+failed`);
    }
});

// --- 3. DELETE THE CUSTOMER ---
// Triggered by the form inside your main table
router.post('/credit/delete/:id', async (req, res) => {
    try {
        await Regicredit.findByIdAndDelete(req.params.id);
        res.redirect('/regicredit');
    } catch (err) {
        res.redirect('/regicredit?error=Could+not+delete+customer');
    }
});

// 4. Deposit Page
router.get("/deposit", async (req, res) => {
  try {
    const stockItems = await Stock.find({
      productName: {
        $regex:
          /cement iiN|cement iiiN|Ironbars 10mm|Iron Bars 12mm|Iron Bars 16mm|Iron sheets/i,
      },
    });

    const customers = await Regicredit.find();

    const deposits = await Deposit.find()
      .populate("customer")
      .sort({ date: -1 });

    res.render("deposit", { stockItems, customers, deposits });
  } catch (error) {
    res.status(500).send("Error loading deposit page: " + error.message);
  }
});

// 5. Process Deposit (POST)
router.post("/deposit", async (req, res) => {
  try {
    const { customerId, itemId, initialDeposit, quantity } = req.body;

    const customer = await Regicredit.findById(customerId);
    const item = await Stock.findById(itemId);
    const qtyWanted = Number(quantity);

    if (item.quantity < qtyWanted) {
      return res
        .status(400)
        .send(`Insufficient Stock! Only ${item.quantity} available.`);
    }
    if (item.sellingPrice <= item.buyingPrice) {
      return res
        .status(400)
        .send("Error: Selling price must be higher than buying price.");
    }

    const itemsTotalValue = item.sellingPrice * qtyWanted;

    let transportFee = 30000;
    if (customer.distanceFromStore <= 10 && itemsTotalValue >= 500000) {
      transportFee = 0;
    }

    const totalCost = itemsTotalValue + transportFee;
    const amountPaid = Number(initialDeposit);
    const remainingBalance = totalCost - amountPaid;

    item.quantity -= qtyWanted;
    await item.save();

    const newDeposit = new Deposit({
      customer: customerId,
      productType: item.productName,
      quantity: qtyWanted,
      totalAmount: totalCost,
      initialDeposit: amountPaid,
      balance: remainingBalance,
      transportFee,
      receiptNumber: "DPST-" + Math.floor(1000 + Math.random() * 9000),
    });

    await newDeposit.save();
    res.redirect("/deposit");
  } catch (error) {
    res.status(400).send("Processing Error: " + error.message);
  }
});

// 6. Receipt (GET)
router.get("/deposit/receipt/:id", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id).populate("customer");
    if (!deposit) return res.status(404).send("Receipt not found");
    res.render("depositReceipt", { deposit });
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

// 7. Edit Deposit (GET)
router.get("/deposit/edit/:id", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id).populate("customer");
    if (!deposit) return res.status(404).send("Record not found");
    res.render("editDeposit", { d: deposit });
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

// 8. Update Deposit (POST)
router.post("/deposit/edit/:id", async (req, res) => {
  try {
    const { newPayment, quantity } = req.body;
    const deposit = await Deposit.findById(req.params.id).populate("customer");

    const goodsValueOnly = deposit.totalAmount - deposit.transportFee;
    const unitPrice = goodsValueOnly / deposit.quantity;

    const updatedQuantity = Number(quantity);
    const newGoodsTotal = unitPrice * updatedQuantity;

    let transportFee = 30000;
    if (deposit.customer.distanceFromStore <= 10 && newGoodsTotal >= 500000) {
      transportFee = 0;
    }

    const updatedTotalPaid = deposit.initialDeposit + Number(newPayment);
    const finalTotalCost = newGoodsTotal + transportFee;
    const newBalance = finalTotalCost - updatedTotalPaid;

    await Deposit.findByIdAndUpdate(req.params.id, {
      quantity: updatedQuantity,
      initialDeposit: updatedTotalPaid,
      totalAmount: finalTotalCost,
      transportFee: transportFee,
      balance: newBalance > 0 ? newBalance : 0,
    });

    res.redirect("/deposit");
  } catch (error) {
    res.status(400).send("Update Error: " + error.message);
  }
});

// 9. Delete Deposit (POST)
router.post("/deposit/delete/:id", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).send("Record not found");

    await Stock.findOneAndUpdate(
      { productName: deposit.productType },
      { $inc: { quantity: deposit.quantity } },
    );

    await Deposit.findByIdAndDelete(req.params.id);
    res.redirect("/deposit");
  } catch (error) {
    res.status(500).send("Error deleting record: " + error.message);
  }
});

module.exports = router;
