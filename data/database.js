const mongodb = require('mongodb');

const MongoClient = mongodb.MongoClient;

let database;

async function connectToDatabase() {
  const uri = process.env.DB_URL;
  const client = await MongoClient.connect(uri);
  database = client.db('online-shop');
}

function getDb() {
  if (!database) {
    throw new Error('You must connect first!');
  }

  return database;
}

module.exports = {
  connectToDatabase: connectToDatabase,
  getDb: getDb
};