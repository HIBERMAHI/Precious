const express = require('express');
const router = express.Router();

router.get('/storedash',(req,res)=>{
    res.render('storedash');
})

router.get('/storsales', (req,res)=>{
    res.render('storsales')
})
 router.get('/invento', (req,res)=>{
    res.render('invento')
 })







module.exports = router;