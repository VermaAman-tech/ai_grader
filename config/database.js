const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;

let sequelize;

if (databaseUrl) {
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true'
        ? { require: true, rejectUnauthorized: false }
        : false,
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      acquire: 30000,
      idle: 10000,
    },
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'intelligrade',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'postgres',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      dialect: 'postgres',
      logging: false,
      define: {
        underscored: true,
        timestamps: true,
      },
      pool: {
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),
        acquire: 30000,
        idle: 10000,
      },
    }
  );
}

module.exports = sequelize;
