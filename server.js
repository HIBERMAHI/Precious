// 1 dependencies

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"])
const express = require("express");
const expressSession = require("express-session");
const path = require("path");
const passport = require("passport");
const MongoStore = require("connect-mongo").default;

require("dotenv").config();
const mongoose = require("mongoose");
// const { connect } = require("http2");
const connectDb = require("./config/db");
// import user model
const Registration = require("./models/Registration");
const Regicredit = require("./models/Regicredit");
// const Product = require("./models/Product");

// app.use("/", productRoutes);
// installations

//2 instanciations
const app = express();
const port = process.env.PORT || 5004;

// prefer DATABASE or DATABASE_URL from .env
const mongoUri = process.env.DATABASE || process.env.DATABASE_URL;

// 3configuratioons
// static files
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
connectDb();

// 4middleware
app.use(express.static(path.join(__dirname, "public")));
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));
// para url installations
app.use(express.urlencoded({ extended: false }));
app.use(
  expressSession({
    secret: "My secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: "sessionStorage",
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 2, // two hours lfe for a login session
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());
// passport configurations
passport.use(Registration.createStrategy());
passport.serializeUser(Registration.serializeUser());
passport.deserializeUser(Registration.deserializeUser());
// global variable to make the loged in user available to all pug templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// 5routes
app.use("/", require("./routes/indexRoutes"));
app.use("/", require("./routes/salesRoutes"));
app.use("/", require("./routes/storeRoutes"));
app.use("/", require("./routes/adminRoutes"));
// app.use('/', require('./routes/l'))

// this is the second last chunk of code
// handling non-existent routes
app.use((req, res) => {
  res.status(404).send("Opps ! Route not found");
});

// bootstrapping server
// Start server locally
if (require.main === module) {
  app.listen(port, () => {
    console.log(`listening on port ${port}`);
  });
}

// Export app for Vercel
module.exports = app;
