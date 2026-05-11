const express = require("express");
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const Regicredit = require("../models/Regicredit");
const Deposit = require("../models/Deposit");
const Registration = require("../models/Registration");

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
    stats.pendingBalance = pendingBalanceAgg.length > 0 ? pendingBalanceAgg[0].balance : 0;
    res.render("admindash", { stats , dbusers});
  } catch (error) {
    console.error(error.message);
    res.status(404).send("Ooops stats not found");
  }
});
// 2. Credit Customer Registration (GET)
router.get("/regicredit", (req, res) => {
  res.render("regicredit");
});
// 3. Credit Customer Registration (POST)
router.post("/regicredit", async (req, res) => {
  try {
    let {
      fullName,
      nin,
      phoneNumber,
      address,
      distanceFromStore,
      email,
      password,
    } = req.body;

    phoneNumber = phoneNumber.replace(/\s+/g, "");
    if (phoneNumber.startsWith("0")) {
      phoneNumber = "+256" + phoneNumber.substring(1);
    } else if (phoneNumber.startsWith("256") && !phoneNumber.startsWith("+")) {
      phoneNumber = "+" + phoneNumber;
    }

    const newCustomer = new Regicredit({
      fullName,
      nin: nin.toUpperCase().trim(),
      phoneNumber,
      address,
      distanceFromStore,
      email,
    });

    await Regicredit.register(newCustomer, password);
    res.redirect("/deposit");
  } catch (error) {
    console.error("Registration Error:", error.message);
    res.status(400).send(`Error: ${error.message}`);
  }
});
// 4. Deposit Page (G
router.get("/deposit", async (req, res) => {
  try {
    const stockItems = await Stock.find({
      productName: {
        $regex:
          /cem iiN|cem iiiN|ironbars 10mm|ironbars 12mm|ironbars 16mm|iron sheets/i,
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


// delet user
router.post("/user/delete/:id", async (req, res) => {
  try {
    await Registration.findByIdAndDelete(req.params.id);
    res.redirect("/admindash"); // Refresh the dashboard to show the user is gone
  } catch (error) {
    console.error("Delete Error:", error.message);
    res.status(500).send("Unable to delete user");
  }
});

// editing user
router.get("/user/update/:id", async (req, res) => {
  try {
    const user = await Registration.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");
    
    // Render a new pug file (e.g., editUser.pug) and pass the user data
    res.render("editUser", { user }); 
  } catch (error) {
    res.status(500).send("Error fetching user details");
  }
});

router.post("/user/update/:id", async (req, res) => {
  try {
    const { fullname, role, phone } = req.body;
    
    // Update the user in the database
    await Registration.findByIdAndUpdate(req.params.id, { 
      fullname, 
      role, 
      phone 
    });
    
    res.redirect("/admindash");
  } catch (error) {
    console.error("Update Error:", error.message);
    res.status(400).send("Update failed: " + error.message);
  }
});

module.exports = router;
