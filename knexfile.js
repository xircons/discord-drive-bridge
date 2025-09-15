const path = require('path');

module.exports = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/drivebot_dev',
    migrations: {
      directory: path.join(__dirname, 'src/database/migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, 'src/database/seeds')
    },
    pool: {
      min: 2,
      max: 10
    }
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: path.join(__dirname, 'src/database/migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, 'src/database/seeds')
    },
    pool: {
      min: 2,
      max: 10
    },
    ssl: {
      rejectUnauthorized: false
    }
  }
};
