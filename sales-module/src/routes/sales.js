const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/requireAuth');

const router = express.Router();

// POST /api/sales — registrar venda
router.post('/', requireAuth, async (req, res) => {
  const { product, amount, conversation_id, contact_id, contact_name, sale_date, notes,
          attendant_id, attendant_name } = req.body;

  if (!product?.trim()) return res.status(400).json({ error: 'Produto é obrigatório' });
  if (!amount || isNaN(amount) || Number(amount) <= 0) return res.status(400).json({ error: 'Valor inválido' });

  // Agentes só registram para si mesmos; admin pode especificar outra atendente
  const finalId = (req.user.role === 'administrator' && attendant_id) ? attendant_id : req.user.id;
  const finalName = (req.user.role === 'administrator' && attendant_name) ? attendant_name : req.user.name;

  try {
    const { rows } = await pool.query(
      `INSERT INTO sales (product, amount, attendant_id, attendant_name, attendant_email,
         conversation_id, contact_id, contact_name, sale_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        product.trim(),
        Number(amount),
        finalId,
        finalName,
        req.user.email,
        conversation_id || null,
        contact_id || null,
        contact_name || null,
        sale_date || new Date().toISOString().split('T')[0],
        notes || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[sales] Erro ao criar:', err);
    res.status(500).json({ error: 'Erro ao registrar venda' });
  }
});

// GET /api/sales — listar vendas
router.get('/', requireAuth, async (req, res) => {
  const { start_date, end_date, attendant_id, product, limit = 100, offset = 0 } = req.query;

  const conditions = [];
  const params = [];
  let i = 1;

  if (req.user.role !== 'administrator') {
    conditions.push(`attendant_id = $${i++}`);
    params.push(req.user.id);
  } else if (attendant_id) {
    conditions.push(`attendant_id = $${i++}`);
    params.push(attendant_id);
  }

  if (start_date) { conditions.push(`sale_date >= $${i++}`); params.push(start_date); }
  if (end_date)   { conditions.push(`sale_date <= $${i++}`); params.push(end_date); }
  if (product)    { conditions.push(`LOWER(product) LIKE $${i++}`); params.push(`%${product.toLowerCase()}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [rows, count] = await Promise.all([
      pool.query(`SELECT * FROM sales ${where} ORDER BY sale_date DESC, created_at DESC LIMIT $${i++} OFFSET $${i}`, [...params, Number(limit), Number(offset)]),
      pool.query(`SELECT COUNT(*) FROM sales ${where}`, params),
    ]);
    res.json({ sales: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error('[sales] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro ao listar vendas' });
  }
});

// GET /api/sales/contact/:contactId — vendas de um contato (painel Chatwoot)
router.get('/contact/:contactId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM sales WHERE contact_id = $1 ORDER BY sale_date DESC, created_at DESC LIMIT 15`,
      [req.params.contactId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar vendas do contato' });
  }
});

// GET /api/sales/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Venda não encontrada' });
    const sale = rows[0];
    if (req.user.role !== 'administrator' && sale.attendant_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    res.json(sale);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar venda' });
  }
});

// PUT /api/sales/:id — editar venda
router.put('/:id', requireAuth, async (req, res) => {
  const { product, amount, sale_date, notes, attendant_id, attendant_name } = req.body;
  try {
    const { rows: existing } = await pool.query('SELECT * FROM sales WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Venda não encontrada' });
    if (req.user.role !== 'administrator' && existing[0].attendant_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { rows } = await pool.query(
      `UPDATE sales SET
         product       = COALESCE($1, product),
         amount        = COALESCE($2, amount),
         sale_date     = COALESCE($3, sale_date),
         notes         = COALESCE($4, notes),
         attendant_id  = CASE WHEN $5::boolean THEN $6 ELSE attendant_id END,
         attendant_name= CASE WHEN $5::boolean THEN $7 ELSE attendant_name END,
         updated_at    = NOW()
       WHERE id = $8 RETURNING *`,
      [
        product || null,
        amount ? Number(amount) : null,
        sale_date || null,
        notes !== undefined ? notes : null,
        req.user.role === 'administrator' && attendant_id ? true : false,
        attendant_id || existing[0].attendant_id,
        attendant_name || existing[0].attendant_name,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[sales] Erro ao editar:', err);
    res.status(500).json({ error: 'Erro ao editar venda' });
  }
});

// DELETE /api/sales/:id — apenas admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM sales WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Venda não encontrada' });
    res.json({ message: 'Venda excluída' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir venda' });
  }
});

module.exports = router;
