"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbPath = process.env.DB_PATH || path_1.default.join(__dirname, "data", "outreachflow.db");
const config = {
    development: {
        client: "better-sqlite3",
        connection: {
            filename: dbPath,
        },
        useNullAsDefault: true,
        migrations: {
            directory: path_1.default.join(__dirname, "src", "db", "migrations"),
        },
        seeds: {
            directory: path_1.default.join(__dirname, "src", "db", "seeds"),
        },
    },
    test: {
        client: "better-sqlite3",
        connection: {
            filename: ":memory:",
        },
        useNullAsDefault: true,
        migrations: {
            directory: path_1.default.join(__dirname, "src", "db", "migrations"),
        },
        seeds: {
            directory: path_1.default.join(__dirname, "src", "db", "seeds"),
        },
    },
    production: {
        client: "better-sqlite3",
        connection: {
            filename: dbPath,
        },
        useNullAsDefault: true,
        migrations: {
            directory: path_1.default.join(__dirname, "src", "db", "migrations"),
        },
        seeds: {
            directory: path_1.default.join(__dirname, "src", "db", "seeds"),
        },
    },
};
exports.default = config;
