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

module.exports = sequelize;
