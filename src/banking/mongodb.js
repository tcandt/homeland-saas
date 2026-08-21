require("dotenv").config();
const { MongoClient } = require("mongodb");

let client;
let db;
let memoryServer;

function describeMongoTarget(uri, databaseName) {
  try {
    const parsed = new URL(uri);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.hostname}${port}/${databaseName}`;
  } catch {
    return databaseName;
  }
}

async function getDatabase() {
  if (db) {
    return db;
  }

  let uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
  const databaseName = process.env.MONGODB_DATABASE || "homeland";

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 2000,
    });
    await client.connect();
    db = client.db(databaseName);
    console.log(`✓ MongoDB connected: ${describeMongoTarget(uri, databaseName)}`);
    return db;
  } catch (err) {
    console.warn(
      `⚠ MongoDB at ${describeMongoTarget(uri, databaseName)} not reachable. Falling back to MongoMemoryServer...`
    );
    try {
      const { MongoMemoryServer } = require("mongodb-memory-server");
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      client = new MongoClient(uri);
      await client.connect();
      db = client.db(databaseName);
      console.log(`✓ MongoMemoryServer ready: ${databaseName}`);
      return db;
    } catch (memErr) {
      console.error("❌ Failed to initialize MongoMemoryServer:", memErr);
      throw err;
    }
  }
}

async function closeDatabase() {
  if (client) {
    await client.close();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
  client = undefined;
  db = undefined;
  memoryServer = undefined;
}

module.exports = {
  getDatabase,
  closeDatabase,
};
