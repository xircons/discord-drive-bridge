const path = require('path');

module.exports = {
  development: {
    client: 'mysql2',
    connection: process.env.DATABASE_URL || 'mysql://discordbot:secure_password_123@localhost:3307/discordbot',
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
    client: 'mysql2',
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
    ssl: false
  }
};
