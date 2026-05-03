const mongoose = require("mongoose");
const passportLocalMongoose =
  require("passport-local-mongoose").default ||
  require("passport-local-mongoose");

const registrationSchema = new mongoose.Schema({
  fullname: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  phone: {
    type: Number,
  },
  nin: {
    type: String,
    trim: true,
    unique: true,
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
