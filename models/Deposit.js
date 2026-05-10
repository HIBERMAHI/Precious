const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    customer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Regicredit', 
        required: true 
    },
    productType: { type: String, required: true }, 
    quantity: { type: Number, default: 1 }, 
    totalAmount: Number,    
    initialDeposit: Number, 
    balance: Number,        
    transportFee: Number, 
    receiptNumber: String, 
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deposit', depositSchema);