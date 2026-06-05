require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Allow Chatwoot to embed the panel in an iframe
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Serve login page for any unmatched HTML route
app.get('*', (req, res) => {
  const page = req.path.replace('/', '') || 'login.html';
  const file = path.join(__dirname, '../public', page.includes('.html') ? page : 'login.html');
  res.sendFile(file, (err) => {
    if (err) res.sendFile(path.join(__dirname, '../public/login.html'));
  });
});

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] Módulo de vendas rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[server] Falha ao inicializar banco de dados:', err);
    process.exit(1);
  });
