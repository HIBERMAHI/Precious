const express = require('express');
const Registration = require('../models/Registration');
const router =  express.Router();

// get index page

router.get('/',(req,res)=>{
    res.render('index');
})

router.get('/login',(req,res)=>{
    res.render('login')
})
router.post('/login',(req,res)=>{
    console.log(req.body)
})

router.get('/register',(req,res)=>{
    res.render('register');
})


router.post('/register', async (req,res)=>{
    try {
        const{fullname,email,password, confirmpassword} = req.body;
let user = await Registration.findOne({email:email.toLowerCase()});
if(user){
    return res.render('register', {email: 'error is already registered'});
}
const newuser = new Registration({
    fullname,
    email: email.toLowerCase(),
    password,
    confirmpassword
})
console.log(newuser)
await newuser.save();
res.redirect('/');

    } catch (error) {
        console.error(error)
    }
})

router.get('/stockview', (req,res)=>{
    res.render('stockview')
})

router.get('/receipt', (req, res)=>{
    res.render('receipt')
})

module.exports = router;