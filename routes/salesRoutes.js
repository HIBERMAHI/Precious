const express = require('express');
const router = express.Router();

router.get('/NewSales',(req, res) =>{
res.render('NewSales')
})

router.get('/credit',(req,res)=>{
    res.render('credit')
})

 router.post('/credit',(req, res) =>{
console.log(req.body)
})

router.get('/salesDash',(req,res)=>{
    res.render('salesDash')
})

router.get('/saleshistory',(req,res)=>{
    res.render('saleshistory')
})


module.exports = router;