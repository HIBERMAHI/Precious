const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema({
 fullname : {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    trim: true
    
  },
  confirmpassword: {
    type: String,
    trim: true
  }
});

module.exports = mongoose.model("Registration", registrationSchema);
