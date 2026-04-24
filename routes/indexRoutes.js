const express = require('express');
const router =  express.Router();

// get index page

router.get('/',(req,res)=>{
    res.render('index')
})

router.get('/stockview', (req,res)=>{
    res.render('stockview')
})

module.exports = router;