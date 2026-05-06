const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
};

const issalesattendant = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === "salesattendant") {
    return next();
  }
  res.status(403).send("Access denied: You are not a salesattendant");
};

const isadmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  res.status(403).send("Access denied: You are not an admin");
};

const isstoremanager = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === "storemanager") {
    return next();
  }
  res.status(403).send("Access denied: You are not a storemanager");
};

const issalesattendantOradmin = (req, res, next) => {
  if (
    req.isAuthenticated() &&
    (req.user.role === "salesattendant" || req.user.role === "admin")
  ) {
    return next();
  }
  res.status(400).send("Access denied");
};

// check if storemanager or admin
const isstoremanagerOradmin = (req, res, next) => {
  if (
    req.isAuthenticated() &&
    (req.user.role === "storemanager" || req.user.role === "admin")
  ) {
    return next();
  }
   res.status(400).send("Access denied");
};

module.exports = {
  isAuthenticated,
  issalesattendant,
  isadmin,
  isstoremanager,
  issalesattendantOradmin,
  isstoremanagerOradmin,
};
