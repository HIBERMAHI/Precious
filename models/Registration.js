const mongoose = require("mongoose");
const passportLocalMongoose =
  require("passport-local-mongoose").default ||
  require("passport-local-mongoose");

const registrationSchema = new mongoose.Schema({
  fullname: {
    type: String,
    trim: true,
    required: true,
  },
  email: {
    type: String,
    trim: true,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
  },
  phone: {
    type: String,
    required: true,
    match: [
      /^(07[0-9]{8}|\+256[0-9]{9})$/,
      "Phone must be 10 digits starting with 07 or 13 characters starting with +256",
    ],
  },
  nin: {
    type: String,
    trim: true,
    unique: true,
    match: [
      /^[A-Z0-9]{14}$/,
      "NIN must be exactly 14 characters (Numbers and Uppercase letters)",
    ],
  },
  role: {
    type: String,
    trim: true,
    required: true,
    enum: ["admin", "storemanager", "salesattendant"],
  },
});

registrationSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
});

module.exports = mongoose.model("Registration", registrationSchema);
