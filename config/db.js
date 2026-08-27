const mongoose = require("mongoose");

const connectDb = async () => {
  try {
    const uri = process.env.DATABASE || process.env.DATABASE_URL;
    if (!uri) {
      throw new Error('No MongoDB connection string found in env (DATABASE or DATABASE_URL)');
    }

    const conn = await mongoose.connect(uri);

    console.log('Database connection successful');
  } catch (error) {
    console.error(`Connection error: ${error.message}`);
    process.exit(1);
  }
};


module.exports = connectDb;
