import knex, { Knex } from 'knex';
import path from 'path';

const environment = process.env.NODE_ENV || 'development';
const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'outreachflow.db');

const config: Record<string, Knex.Config> = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
  },
  test: {
    client: 'better-sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
    },
  },
  production: {
    client: 'better-sqlite3',
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
  },
};

export const db: Knex = knex(config[environment] || config.development);
