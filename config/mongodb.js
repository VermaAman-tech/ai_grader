const mongoose = require('mongoose');

let connected = false;

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[MongoDB] MONGODB_URI not set — chat will fall back to PostgreSQL ChatMessage.');
    return false;
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || 'intelligrade',
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
    });
    connected = true;
    console.log('[MongoDB] Connected for chat storage.');
    return true;
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    return false;
  }
}

function isMongoConnected() {
  return connected && mongoose.connection.readyState === 1;
}

module.exports = { connectMongo, isMongoConnected };
