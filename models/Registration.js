const mongoose = require("mongoose");
const passportLocalMongoose =
  require("passport-local-mongoose").default ||
  require("passport-local-mongoose");

const registrationSchema = new mongoose.Schema({
  fullname: {
    type: String,
    trim: true,
    required:true,
  },
  email: {
    type: String,
    trim: true,
    required: true,
    unique:true,
  },
  phone: {
    type: String,
    required:true,
    match:[/^\+256\d{9}$/,"please use the format +256xxxxxxx"]
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
