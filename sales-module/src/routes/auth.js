const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  // Admin local — ativo quando CHATWOOT_URL não está configurado ou quando
  // as variáveis LOCAL_ADMIN_EMAIL/LOCAL_ADMIN_PASSWORD estão definidas
  const localEmail = process.env.LOCAL_ADMIN_EMAIL;
  const localPass  = process.env.LOCAL_ADMIN_PASSWORD;
  if (localEmail && localPass) {
    if (email === localEmail && password === localPass) {
      const user = { id: 1, name: 'Admin', email: localEmail, role: 'administrator' };
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user });
    }
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  }

  try {
    const response = await axios.post(
      `${process.env.CHATWOOT_URL}/auth/sign_in`,
      { email, password },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const raw = response.data?.data?.attributes ?? response.data?.data ?? response.data;
    const user = {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      role: raw.role,
      avatar_url: raw.avatar_url,
      chatwoot_token: raw.access_token,
    };

    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url } });
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }
    console.error('[auth] Erro ao autenticar:', err.message);
    res.status(502).json({ error: 'Não foi possível conectar ao servidor de autenticação' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const { id, name, email, role, avatar_url } = req.user;
  res.json({ user: { id, name, email, role, avatar_url } });
});

module.exports = router;
