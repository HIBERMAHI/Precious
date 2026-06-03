const express = require("express");
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const Regicredit = require("../models/Regicredit");
const Deposit = require("../models/Deposit");
const Registration = require("../models/Registration");
const { isadmin } = require("../middleware/auth");

// 1. Dashboard Stats Route (UPGRADED FOR MULTI-ITEM)
router.get("/admindash", async (req, res) => {
  try {
    const dbusers = await Registration.find();
    let stats = {
      salesRevenue: 0,
      inventoryValue: 0,
      depositsCollected: 0,
      pendingBalance: 0,
    };

    // 1. Calculate total sales revenue (Adds totalAmount and transportFee together for each sale)
    const salesAgg = await Sale.aggregate([
      {
        $group: {
          _id: null,
          grandTotal: { $sum: { $add: ["$totalAmount", "$transportFee"] } },
        },
      },
    ]);
    stats.salesRevenue = salesAgg.length > 0 ? salesAgg[0].grandTotal : 0;

    const inventoryAgg = await Stock.aggregate([
      { $match: { isRestockRecord: { $ne: true } } },
      {
        $project: {
          currentValue: { $multiply: ["$quantity", "$buyingPrice"] },
        },
      },
      { $group: { _id: null, grandExpenditure: { $sum: "$currentValue" } } },
    ]);
    stats.inventoryValue =
      inventoryAgg.length > 0 ? inventoryAgg[0].grandExpenditure : 0;

    // 3. Calculate total deposit payments collected today
    const depositsCollectedAgg = await Deposit.aggregate([
      { $group: { _id: null, deposits: { $sum: "$initialDeposit" } } },
    ]);
    stats.depositsCollected =
      depositsCollectedAgg.length > 0 ? depositsCollectedAgg[0].deposits : 0;

    // 4. Calculate total outstanding pending balances owed by salary earners
    const pendingBalanceAgg = await Deposit.aggregate([
      { $group: { _id: null, balance: { $sum: "$balance" } } },
    ]);
    stats.pendingBalance =
      pendingBalanceAgg.length > 0 ? pendingBalanceAgg[0].balance : 0;

    // 5. Render to your admin interface template file
    res.render("admindash", { stats, dbusers });
  } catch (error) {
    console.error("Dashboard Stats Error:", error.message);
    res.status(500).send("Ooops stats not found");
  }
});

// 2. Credit Customer Registration (GET)
router.get("/regicredit", isadmin, async (req, res) => {
  try {
    const customers = await Regicredit.find().sort({ _id: -1 });
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
    hasOwnTransport,
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
    const ninRegex = /^(CM|CF)[0-9]{2}[A-Z0-9]{10}$/;
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
      hasOwnTransport: hasOwnTransport === "on",
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

router.post("/credit/update/:id", async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      address,
      distanceFromStore,
      password,
      hasOwnTransport,
    } = req.body;

    // Validation: Ensure password length matches your rules
    if (password.length < 6 || password.length > 14) {
      return res.redirect(
        `/credit/edit/${req.params.id}?error=Password+must+be+6-14+characters`,
      );
    }

    await Regicredit.findByIdAndUpdate(
      req.params.id,
      {
        fullName,
        phoneNumber,
        address,
        distanceFromStore,
        hasOwnTransport: hasOwnTransport === "on",
      },
      { runValidators: true },
    );

    res.redirect("/regicredit"); // Return to table after success
  } catch (err) {
    res.redirect(`/credit/edit/${req.params.id}?error=Update+failed`);
  }
});

// --- 3. DELETE THE CUSTOMER ---
// Triggered by the form inside your main table
router.post("/credit/delete/:id", async (req, res) => {
  try {
    await Regicredit.findByIdAndDelete(req.params.id);
    res.redirect("/regicredit");
  } catch (err) {
    res.redirect("/regicredit?error=Could+not+delete+customer");
  }
});

// 4. Deposit Page
// 4. Deposit Page (GET)
router.get("/deposit", async (req, res) => {
  try {
    // 1. Fetch stock items matching your specific material rules
    const stockItems = await Stock.find({
      productName: {
        $regex:
          /cement iiN|cement iiiN|Iron Bars 10mm|Iron Bars 12mm|Iron Bars 16mm|Iron sheets/i,
      },
    });

    // 2. Fetch all registered credit customers for the dropdown menu
    const customers = await Regicredit.find();

    // 3. Fetch deposit history records
    // CHANGED: Added nested population for 'items.productName' so we can see what materials were bought
    const deposits = await Deposit.find()
      .populate("customer")
      .populate("items.productName")
      .sort({ date: -1 });

    // 4. Render the page with all necessary data arrays
    res.render("deposit", { stockItems, customers, deposits });
  } catch (error) {
    res.status(500).send("Error loading deposit page: " + error.message);
  }
});
// 5. Process Deposit (POST)
router.post("/deposit", async (req, res) => {
  try {
    const { customerId, itemId, quantity, initialDeposit } = req.body;

    // 1. Fetch the customer from the database to look up their pre-registered distance
    const customer = await Regicredit.findById(customerId);
    if (!customer) {
      return res
        .status(404)
        .send("Error: Registered customer profile not found.");
    }
    const customerDistance = customer.distanceFromStore;

    // 2. Normalize the form inputs into standard arrays (handles 1 item or many items seamlessly)
    const itemsArray = Array.isArray(itemId) ? itemId : [itemId];
    const quantitiesArray = Array.isArray(quantity) ? quantity : [quantity];

    let materialsSubtotal = 0;
    const compiledCartItems = [];

    // 3. The Validation Loop: Check stock and prices for every single item in the cart
    for (let i = 0; i < itemsArray.length; i++) {
      const stockItem = await Stock.findById(itemsArray[i]);

      if (!stockItem) {
        return res
          .status(400)
          .send(`Error: Product not found in inventory database.`);
      }

      const qtyWanted = Number(quantitiesArray[i]);

      // Guard A: Ensure quantity is a valid positive integer
      if (!qtyWanted || qtyWanted <= 0) {
        return res
          .status(400)
          .send("Error: Quantity wanted must be greater than 0.");
      }

      // Guard B: Inventory stock exhaustion check
      if (stockItem.quantity < qtyWanted) {
        return res
          .status(400)
          .send(
            `Insufficient Stock! ${stockItem.productName} only has ${stockItem.quantity} units available.`,
          );
      }

      // Guard C: Profit margin validation rule (Selling price must be strictly higher than buying price)
      if (stockItem.sellingPrice <= stockItem.buyingPrice) {
        return res
          .status(400)
          .send(
            `Error: Selling price for ${stockItem.productName} (${stockItem.sellingPrice.toLocaleString()} UGX) must be higher than its buying price (${stockItem.buyingPrice.toLocaleString()} UGX) to prevent financial losses.`,
          );
      }

      // Calculate costs for this row if all checks pass
      const itemCost = stockItem.sellingPrice * qtyWanted;
      materialsSubtotal += itemCost;

      // Push into the array layout matching your upgraded schema structure
      compiledCartItems.push({
        productName: stockItem._id,
        quantity: qtyWanted,
        price: stockItem.sellingPrice,
        total: itemCost,
      });
    }
    let transportFee = 30000; // Default charge

    // Rule: If customer has own transport, fee is 0.
    // Otherwise, apply distance & spending thresholds.
    if (customer.hasOwnTransport) {
      transportFee = 0;
    } else if (
      customer.distanceFromStore <= 10 &&
      materialsSubtotal >= 500000
    ) {
      transportFee = 0;
    }
    const amountPaid = Number(initialDeposit) || 0;
    const overallInvoiceGrandTotal = materialsSubtotal + transportFee;
    const remainingBalance = overallInvoiceGrandTotal - amountPaid;

    // Generate unique tracking code matching your system format
    const generatedReceiptNumber =
      "DPST-" + Math.floor(1000 + Math.random() * 9000);
    const newDeposit = new Deposit({
      customer: customerId,
      items: compiledCartItems, // Saves the entire cart list array structure
      totalAmount: overallInvoiceGrandTotal,
      initialDeposit: amountPaid,
      balance: remainingBalance,
      transportFee,
      receiptNumber: generatedReceiptNumber,
      date: new Date(),
    });

    await newDeposit.save();
    for (const element of compiledCartItems) {
      await Stock.findByIdAndUpdate(element.productName, {
        $inc: { quantity: -element.quantity },
      });
    }

    // Redirect smoothly back to the deposit page view table layout
    res.redirect("/deposit");
  } catch (error) {
    console.error("Multi-item Deposit Error:", error.message);
    res.status(500).send("Processing Error: " + error.message);
  }
});

// 6. Receipt (GET)
// 6. Receipt (GET)
router.get("/deposit/receipt/:id", async (req, res) => {
  try {
    // FETCH & POPULATE: Step inside the items array to extract real product details (like names) from Stock
    const deposit = await Deposit.findById(req.params.id)
      .populate("customer")
      .populate("items.productName");

    if (!deposit) {
      return res.status(404).send("Receipt not found");
    }

    // Render the receipt print layout template file
    res.render("depositReceipt", { deposit });
  } catch (error) {
    res.status(500).send("Error generating receipt layout: " + error.message);
  }
});
// 7. Edit Deposit (GET)
router.get("/deposit/edit/:id", async (req, res) => {
  try {
    // FIX: Chain another .populate() to deeply load the item details from Stock
    const deposit = await Deposit.findById(req.params.id)
      .populate("customer")
      .populate({
        path: "items.productName",
        model: "Stock", // This forces Mongoose to look into your Stock model
      });

    if (!deposit) return res.status(404).send("Record not found");

    // Render with the fully loaded items data
    res.render("editDeposit", { d: deposit, error: null });
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

// 8. Update Deposit (POST)
// 8. Update Deposit Ledger & Balance Owed (POST)
router.post("/deposit/edit/:id", async (req, res) => {
  try {
    const { newPayment, quantity } = req.body;

    // 1. Fetch the original transaction document
    const deposit = await Deposit.findById(req.params.id).populate("customer");
    if (!deposit) return res.status(404).send("Deposit record not found");

    // Convert inputs into standard arrays to handle single or multiple items uniformly
    const quantitiesInputArray = Array.isArray(quantity)
      ? quantity
      : [quantity];
    let recomputedMaterialsSubtotal = 0;
    const updatedCartItems = [];

    // 2. THE PROCESSING LOOP: Re-evaluate every product line item in the cart
    for (let i = 0; i < deposit.items.length; i++) {
      const originalItem = deposit.items[i];
      const targetStockItem = await Stock.findById(originalItem.productName);

      const freshQtyWanted = Number(quantitiesInputArray[i]);
      if (!freshQtyWanted || freshQtyWanted <= 0) {
        return res
          .status(400)
          .send("Error: Product quantity must be 1 or higher.");
      }

      // Calculate the difference between the old quantity and the new quantity
      // Example: Changing from 5 bags to 7 bags = +2 (Deduct 2 more from stock)
      // Example: Changing from 5 bags to 3 bags = -2 (Return 2 back to stock)
      const stockDifference = freshQtyWanted - originalItem.quantity;

      // Guard: Verify warehouse inventory capacity before allowing an increase
      if (stockDifference > 0 && targetStockItem.quantity < stockDifference) {
        return res
          .status(400)
          .send(
            `Insufficient Stock! ${targetStockItem.productName} cannot cover the requested increase.`,
          );
      }

      // Adjust physical warehouse inventory dynamically using the difference
      await Stock.findByIdAndUpdate(originalItem.productName, {
        $inc: { quantity: -stockDifference },
      });

      // Compute costs based on the lock-in price saved during the initial deposit
      const lineTotalCost = originalItem.price * freshQtyWanted;
      recomputedMaterialsSubtotal += lineTotalCost;

      // Construct updated sub-document item structure
      updatedCartItems.push({
        productName: originalItem.productName,
        quantity: freshQtyWanted,
        price: originalItem.price,
        total: lineTotalCost,
      });
    }
    let transportFee = 30000; // Reset to standard default charge

    // --- UPDATED TRANSPORT FEE LOGIC (THE SAME AS POST /deposit) ---
    // Rule: If they have their own, it's 0. Otherwise, apply distance/value rules.
    if (deposit.customer.hasOwnTransport) {
      transportFee = 0;
    } else if (
      deposit.customer.distanceFromStore <= 10 &&
      recomputedMaterialsSubtotal >= 500000
    ) {
      transportFee = 0;
    }

    // Accumulate the original deposit with the newly provided top-up payment amount
    const upgradedTotalPaymentsCollected =
      deposit.initialDeposit + (Number(newPayment) || 0);

    // Calculate the new grand total invoice price
    const revisedGrandInvoiceCost = recomputedMaterialsSubtotal + transportFee;

    // Calculate the remaining balance
    const computedOutstandingBalance =
      revisedGrandInvoiceCost - upgradedTotalPaymentsCollected;
    await Deposit.findByIdAndUpdate(req.params.id, {
      items: updatedCartItems,
      initialDeposit: upgradedTotalPaymentsCollected,
      totalAmount: revisedGrandInvoiceCost,
      transportFee: transportFee,
      balance: computedOutstandingBalance > 0 ? computedOutstandingBalance : 0,
    });

    res.redirect("/deposit");
  } catch (error) {
    res.status(400).send("Update Processing Failure: " + error.message);
  }
});

// 9. Delete Deposit (POST)
// 9. Delete Deposit (FIXED FOR MULTI-ITEM ARRAY HOOKS)
router.post("/deposit/delete/:id", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).send("Record not found");

    // Loop through every item inside the multi-item array structure to restore warehouse stock levels
    for (const element of deposit.items) {
      await Stock.findByIdAndUpdate(element.productName, {
        $inc: { quantity: element.quantity }, // Adds physical items back to storage
      });
    }

    await Deposit.findByIdAndDelete(req.params.id);
    res.redirect("/deposit");
  } catch (error) {
    res.status(500).send("Error deleting record: " + error.message);
  }
});

module.exports = router;
