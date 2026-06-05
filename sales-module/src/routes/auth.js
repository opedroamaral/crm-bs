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

  try {
    const response = await axios.post(
      `${process.env.CHATWOOT_URL}/auth/sign_in`,
      { email, password },
      { headers: { 'Content-Type': 'application/json' } }
    );

    // Chatwoot returns user under data.data.attributes (v2 API)
    const raw = response.data?.data?.attributes ?? response.data?.data ?? response.data;
    const user = {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      role: raw.role,             // 'administrator' or 'agent'
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
