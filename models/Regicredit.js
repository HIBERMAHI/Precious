const mongoose = require('mongoose');
const passportLocalMongoose =
  require("passport-local-mongoose").default ||
  require("passport-local-mongoose");


const regicreditSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    nin: { 
        type: String, 
        unique: true, 
        required: true,
        match: [/^[A-Z0-9]{14}$/, 'NIN must be exactly 14 characters']
    },
    phoneNumber: { 
        type: String, 
      equired: true,
        // UPDATED REGEX: Allows any digit after +256 to prevent the error you see
        match: [/^\+256\d{9}$/, 'Phone must start with +256 followed by 9 digits']
    },
    address: { type: String, required: true },
    distanceFromStore: { type: Number, required: true },
    email: { type: String, unique: true }
});

regicreditSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
});

module.exports = mongoose.model('Regicredit', regicreditSchema);