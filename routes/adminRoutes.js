const express = require('express');
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const Regicredit = require("../models/Regicredit");
const Deposit = require("../models/Deposit");

// 1. Dashboard Stats Route
router.get('/admindash', async (req, res) => {
    try {
        let stats = {
            salesRevenue: 0,
            inventoryValue: 0,
        };

        const salesAgg = await Sale.aggregate([
            { $group: { _id: null, grandTotal: { $sum: '$totalAmount' } } }
        ]);
        stats.salesRevenue = salesAgg.length > 0 ? salesAgg.grandTotal : 0;

        const inventoryAgg = await Stock.aggregate([
            { $group: { _id: null, grandExpenditure: { $sum: '$total' } } }
        ]);
        stats.inventoryValue = inventoryAgg.length > 0 ? inventoryAgg.grandExpenditure : 0;

        res.render('admindash', { stats });
    } catch (error) {
        console.error(error.message);
        res.status(400).send('Ooops! stats not found');
    }
});

// 2. Credit Customer Registration (GET)
router.get('/regicredit', (req, res) => {
    res.render('regicredit');
});

// 3. Credit Customer Registration (POST) - With Auto-Formatting
router.post('/regicredit', async (req, res) => {
    try {
        let { fullName, nin, phoneNumber, address, distanceFromStore, email, password } = req.body;

        // Clean and Format Phone Number
        phoneNumber = phoneNumber.replace(/\s+/g, '');
        if (phoneNumber.startsWith('0')) {
            phoneNumber = '+256' + phoneNumber.substring(1);
        } else if (phoneNumber.startsWith('256') && !phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber;
        }

        const newCustomer = new Regicredit({ 
            fullName, 
            nin: nin.toUpperCase().trim(), 
            phoneNumber, 
            address, 
            distanceFromStore, 
            email 
        });

        await Regicredit.register(newCustomer, password);
        res.redirect('/deposit'); 
    } catch (error) {
        console.error("Registration Error:", error.message);
        res.status(400).send(`Error: ${error.message}`);
    }
});

// 4. Deposit Page (GET) - FIXED: Now ignores case sensitivity for stock items

// GET: Load page with filtered stock and existing records

router.get('/deposit', async (req, res) => {
    try {
        // Fetch only specific hardware items (case-insensitive)
        const stockItems = await Stock.find({
            productName: { 
                $regex: /cem iiN|cem iiiN|ironbars 10mm|ironbars 12mm|ironbars 16mm|iron sheets/i 
            }
        });

        const customers = await Regicredit.find();
        
        // Retrieve all records and link (populate) customer data
        const deposits = await Deposit.find()
            .populate('customer')
            .sort({ date: -1 });

        res.render('deposit', { stockItems, customers, deposits });
    } catch (error) {
        res.status(500).send("Error loading deposit page: " + error.message);
    }
});

// POST: Process the Transaction
router.post('/deposit', async (req, res) => {
    try {
        const { customerId, itemId, initialDeposit, quantity } = req.body;
        
        const customer = await Regicredit.findById(customerId);
        const item = await Stock.findById(itemId);
        const qtyWanted = Number(quantity);

        // 1. VALIDATIONS
        if (item.quantity < qtyWanted) {
            return res.status(400).send(`Insufficient Stock! Only ${item.quantity} available.`);
        }
        if (item.sellingPrice <= item.buyingPrice) {
            return res.status(400).send("Error: Selling price must be higher than buying price.");
        }

        // 2. MATH CALCULATIONS
        const itemsTotalValue = item.sellingPrice * qtyWanted;
        
        // Transport: Free if Distance <= 10km AND Total Value >= 500,000 UGX
        let transportFee = 30000;
        if (customer.distanceFromStore <= 10 && itemsTotalValue >= 500000) {
            transportFee = 0;
        }

        const totalCost = itemsTotalValue + transportFee;
        const amountPaid = Number(initialDeposit);
        const remainingBalance = totalCost - amountPaid;

        // 3. UPDATE STOCK & SAVE DEPOSIT
        item.quantity -= qtyWanted; // Reduce store inventory
        await item.save();

        const newDeposit = new Deposit({
            customer: customerId,
            productType: item.productName,
            quantity: qtyWanted,
            totalAmount: totalCost,
            initialDeposit: amountPaid,
            balance: remainingBalance,
            transportFee,
            receiptNumber: "DPST-" + Math.floor(1000 + Math.random() * 9000)
        });

        await newDeposit.save();
        res.redirect('/deposit');
    } catch (error) {
        res.status(400).send("Processing Error: " + error.message);
    }
});

// GET: Individual Receipt for Printing
router.get('/deposit/receipt/:id', async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id).populate('customer');
        if (!deposit) return res.status(404).send("Receipt not found");
        res.render('depositReceipt', { deposit });
    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});

module.exports = router;