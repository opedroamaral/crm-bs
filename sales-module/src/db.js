require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  product VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  attendant_id INTEGER NOT NULL,
  attendant_name VARCHAR(255) NOT NULL,
  attendant_email VARCHAR(255),
  conversation_id INTEGER,
  contact_id INTEGER,
  contact_name VARCHAR(255),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_goals (
  id SERIAL PRIMARY KEY,
  attendant_id INTEGER NOT NULL,
  attendant_name VARCHAR(255) NOT NULL,
  attendant_email VARCHAR(255),
  target_amount DECIMAL(10,2) NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attendant_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_sales_attendant_id ON sales(attendant_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product);
CREATE INDEX IF NOT EXISTS idx_sales_contact_id ON sales(contact_id);
`;

async function initDb() {
  await pool.query(MIGRATIONS);
  console.log('[db] Tabelas verificadas/criadas com sucesso');
}

module.exports = { pool, initDb };
