const MONGO_IP = process.env.MONGO_IP || "mongo";
const MONGO_PORT = process.env.MONGO_PORT || 27017;
const MONGO_USER = process.env.MONGO_USER || "edward";
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || "password";
const REDIS_URL = process.env.REDIS_URL || "redis";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const MONGO_URI_REPLICAS =
  process.env.MONGO_URI_REPLICAS || `${MONGO_IP}:${MONGO_PORT}/?authSource=admin`;

module.exports = {
  MONGO_IP,
  MONGO_PORT,
  MONGO_URI_REPLICAS,
  MONGO_USER,
  MONGO_PASSWORD,
  REDIS_URL,
  REDIS_PORT,
};
