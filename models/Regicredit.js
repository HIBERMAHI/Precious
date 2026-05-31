const mongoose = require("mongoose");
const passportLocalMongoose =
  require("passport-local-mongoose").default ||
  require("passport-local-mongoose");

const regicreditSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  nin: {
    type: String,
    trim: true,
    unique: true,
    required: true,
    match: [
      /^(CM|CF)[0-9]{2}[A-Z0-9]{10}$/,
      "NIN must start with CM or CF, followed by 2 digits (birth year) and 10 alphanumeric characters (14 total).",
    ],
  },
  phoneNumber: {
    type: String,
    required: true,
    // UPDATED REGEX: Allows any digit after +256 to prevent the error you see
    match: [/^(?:07\d{8}|\+256\d{9})$/, "Phone must start with 07 or +256"],
  },
  address: { type: String, required: true, trim: true },
  distanceFromStore: { type: Number, required: true },
  hasOwnTransport: { type: Boolean, default: false }, // Add this
  email: {
    type: String,
    trim: true,
    unique: true,
    required: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
  },
});

regicreditSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
});

module.exports = mongoose.model("Regicredit", regicreditSchema);
