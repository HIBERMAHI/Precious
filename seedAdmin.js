const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const mongoose = require("mongoose");
const Registration = require("./models/Registration");

const seedAdmin = async () => {
  try {
    const mongoUri =
      process.env.DATABASE || process.env.DATABASE_URL;

    if (!mongoUri) {
      throw new Error("MongoDB connection string is missing.");
    }

    await mongoose.connect(mongoUri);

    console.log("Connected to MongoDB");

    const existingAdmin = await Registration.findOne({
      email: "admin@nyondo.com",
    });

    if (existingAdmin) {
      console.log("Admin already exists.");
      await mongoose.connection.close();
      return;
    }

    const admin = new Registration({
      fullname: "System Administrator",
      email: "admin@nyondo.com",
      phone: "0700000000",
      nin: "CM00ABCD123456",
      role: "admin",
    });

    await Registration.register(admin, "Admin123456");

    console.log("Admin created successfully!");
    console.log("Email: admin@nyondo.com");

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding admin:", error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
};

seedAdmin();