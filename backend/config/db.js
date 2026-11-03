const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Build URI with retryWrites=false explicitly
    const rawUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mimir';
    const baseUri = rawUri.split('?')[0];
    const uri = `${baseUri}?retryWrites=false&directConnection=true`;

    const conn = await mongoose.connect(uri, {
      retryWrites: false,
      directConnection: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
