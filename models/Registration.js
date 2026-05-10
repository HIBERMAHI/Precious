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
    match:[/^\+256[0-9]{9}$/,"please use the format +256xxxxxxx"]
  },
  nin: {
    type: String,
    trim: true,
    unique: true,
    match:[/^[A-Z0-9]{14}$/,"NIN  must be 14 characters"]
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
