const { Sequelize } = require('sequelize');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './data/intelligrade.db';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(dbPath),
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
});

sequelize.query('PRAGMA journal_mode = WAL;').catch(() => {});
sequelize.query('PRAGMA busy_timeout = 5000;').catch(() => {});
sequelize.query('PRAGMA foreign_keys = ON;').catch(() => {});

module.exports = sequelize;
