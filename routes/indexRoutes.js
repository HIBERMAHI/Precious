const express = require("express");
const Registration = require("../models/Registration");
const router = express.Router();
const passport = require("passport");

const {
  issalesattendant,
  isadmin,
  isstoremanager,
  isstoremanagerOradmin,
  issalesattendantOradmin,
} = require("../middleware/auth");
const { transformAuthInfo } = require("passport");

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
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

router.get("/register", isadmin, (req, res) => {
  res.render("register");
});

router.post("/register", isadmin, async (req, res) => {
  const { fullname, email, phone, nin, role, password } = req.body;

  try {
    // 1. Password Validation (6-14 characters)
    if (!password || password.length < 6 || password.length > 14) {
      return res.render("register", {
        error: "Password must be between 6 and 14 characters long.",
        // We do NOT pass back the body, so the form returns fresh/empty
      });
    }

    // 2. Formatting Data for consistency
    const cleanEmail = email.toLowerCase().trim();
    const cleanNIN = nin.toUpperCase().trim();

    // 3. Duplicate Email Check (Manual check before Register)
    let existingUser = await Registration.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.render("register", {
        error: "A user with this email already exists.",
      });
    }

    // 4. Create User Instance
    // Note: Phone and NIN will be validated against the model's match regex during .register()
    const newuser = new Registration({
      fullname,
      email: cleanEmail,
      phone, // Model regex handles the 07... or +256... check
      nin: cleanNIN,
      role,
    });
    // 5. Register with Passport
    // We use the promise-based version (await) instead of a callback for cleaner code
    await Registration.register(newuser, password);

    res.redirect("/login");
  } catch (error) {
    console.error("Registration Error:", error);

    let errorMessage = "Registration failed. Please try again.";

    // Catching Model Match Errors (Phone/NIN regex failures)
    if (error.name === "ValidationError") {
      errorMessage = Object.values(error.errors).message;
    }
    // Catching Duplicate NIN (MongoDB error code 11000)
    else if (error.code === 11000) {
      errorMessage = "This NIN is already registered to another account.";
    }

    res.render("register", { error: errorMessage });
  }
});

// editing and deleting 
// ==========================================
// 10. Edit User (GET) - Load the Edit Page
// ==========================================
router.get("/user/update/:id", async (req, res) => {
  try {
    const user = await Registration.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");
    
    // Ensure 'updateUser' matches your Pug filename
    res.render("updateUser", { user }); 
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching user details");
  }
});

// ==========================================
// 11. Update User (POST) - Save changes with Validation
// ==========================================
router.post("/user/update/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { phone, role } = req.body;

    // Validation for Ugandan formats: +256... or 07...
    const phoneRegex = /^(\+256|07)\d{8}$/;

    if (!phoneRegex.test(phone)) {
      // If validation fails, we find the user again to keep the Name/ID for the page
      const user = await Registration.findById(userId);
      return res.render("updateUser", { 
        user, 
        error: "Invalid phone! Use +256700000000 or 0700000000." 
      });
    }

    // Update only the Phone and Role
    await Registration.findByIdAndUpdate(userId, { phone, role });
    
    // Success - go back to the dashboard
    res.redirect("/admindash");

  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ==========================================
// 12. Delete User (POST) - Triggered by Dashboard Form
// ==========================================
router.post("/user/delete/:id", async (req, res) => {
  try {
    // Finds the user by ID from the URL and removes them
    await Registration.findByIdAndDelete(req.params.id);
    res.redirect("/admindash");
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).send("Error deleting user");
  }
});

module.exports = router;
