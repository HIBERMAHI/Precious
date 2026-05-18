const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    customer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Regicredit', 
        required: true 
    },
    // UPGRADED: This array acts as the digital shopping cart holding all selected materials
    items: [{
        productName: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Stock', // References your inventory model
            required: true 
        },
        quantity: { 
            type: Number, 
            required: true,
            min: 1
        },
        price: { 
            type: Number, 
            required: true 
        },
        total: { 
            type: Number, 
            required: true 
        }
    }],
    totalAmount: { 
        type: Number, 
        required: true 
    }, // Cumulative subtotal of all goods combined
    initialDeposit: { 
        type: Number, 
        required: true 
    }, 
    balance: { 
        type: Number, 
        required: true 
    },        
    transportFee: { 
        type: Number, 
        required: true 
    }, // Calculated on the backend using customer's registered distance
    receiptNumber: { 
        type: String, 
        required: true 
    }, 
    date: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Deposit', depositSchema);