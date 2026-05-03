const express = require("express");
const Registration = require("../models/Registration");
const router = express.Router();
const passport = require("passport");

// get index page

router.get("/", (req, res) => {
  res.render("index");
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/login" }),
  (req, res) => {
    if (req.user.role === "admin") {
      res.redirect("/admindash");
    } else if (req.user.role === "salesattendant") {
      res.redirect("/ssales");
    } else if (req.user.role === "storemanager") {
      res.redirect("/storedash");
    } else {
      res.redirect("/");
    }
  },
);

// logout
router.get('/logout',(req,res,next)=>{
    req.logout( (err)=>{
        if(err){
            return next(err)
        }
        res.redirect('/')
    })
})

router.get("/register", (req, res) => {
  res.render("register");
});

router.post("/register", async (req, res) => {
  try {
    const { fullname, email, phone, nin, role, password } = req.body;
    let user = await Registration.findOne({ email: email.toLowerCase() });
    if (user) {
      return res.render("register", { email: "error is already registered" });
    }
    const newuser = new Registration({
      fullname,
      email: email.toLowerCase(),
      phone,
      nin: nin.toUpperCase(),
      role,
      password,
    });
    console.log(newuser);
    await Registration.register(newuser, req.body.password, (err) => {
      if (err) {
        return res.redirect("/register");
      }
      res.redirect("/login");
    });
  } catch (error) {
    console.error(error);
    res.render("register", { error: error.message });
  }
});

router.get("/stockview", (req, res) => {
  res.render("stockview");
});

router.get("/receipt", (req, res) => {
  res.render("receipt");
});

module.exports = router;
