const express = require('express');
const router = express.Router();
const Stock = require("../models/Stock");
const Sale = require("../models/Sale");


router.get('/sdebit',(req,res)=>{
    res.render('sdebit')
})

router.get('/admindash',async(req,res)=>{
try {
    let stats = {
        salesRevenue:0,
        inventoryValue:0,
    }
    const salesAgg = await Sale.aggregate(
        [{$group:{_id:null,grandTotal:{$sum:'$totalAmount'}}}] 
    );
    stats.salesRevenue = salesAgg.length > 0 ? salesAgg[0].grandTotal:0;
// calculate total sales revenue
// cal total inventory value
const inventoryAgg  = await Stock.aggregate(
    [{$group:{_id:null,grandExpenditure:{$sum:'$total'}}}]
);
stats.inventoryValue = inventoryAgg.length > 0 ? inventoryAgg[0].grandExpenditure:0;
 res.render('admindash', {stats});

} catch (error) {
    console.error(error.message)
    res.status(400).send('Ooops! stats not found')
}
})

module.exports = router;