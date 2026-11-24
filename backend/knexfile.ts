import type { Knex } from "knex";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DB_PATH || path.join(__dirname, "data", "outreachflow.db");

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "better-sqlite3",
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, "src", "db", "migrations"),
    },
    seeds: {
      directory: path.join(__dirname, "src", "db", "seeds"),
    },
  },
  test: {
    client: "better-sqlite3",
    connection: {
      filename: ":memory:",
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, "src", "db", "migrations"),
    },
    seeds: {
      directory: path.join(__dirname, "src", "db", "seeds"),
    },
  },
  production: {
    client: "better-sqlite3",
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, "src", "db", "migrations"),
    },
    seeds: {
      directory: path.join(__dirname, "src", "db", "seeds"),
    },
  },
};

export default config;
