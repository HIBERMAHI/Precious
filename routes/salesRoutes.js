const express = require('express');
const router = express.Router();

router.get('/NewSales',(req, res) =>{
res.render('NewSales')
})

 router.post('/NewSales',(req, res) =>{
console.log(req.body)
})






module.exports = router;