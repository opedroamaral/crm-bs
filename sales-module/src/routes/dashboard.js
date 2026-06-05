const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/requireAuth');

const router = express.Router();

function resolvePeriod(period, start_date, end_date) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  switch (period) {
    case 'today':
      return { start: today, end: today };
    case '7d': {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { start: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, end: today };
    }
    case '30d': {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      return { start: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, end: today };
    }
    case 'custom':
      return { start: start_date || today, end: end_date || today };
    default: // this_month
      return { start: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, end: today };
  }
}

// GET /api/dashboard/summary — resumo geral (admin)
router.get('/summary', requireAuth, requireAdmin, async (req, res) => {
  const { period = 'this_month', start_date, end_date, attendant_id } = req.query;
  const { start, end } = resolvePeriod(period, start_date, end_date);

  const params = [start, end];
  const extra = attendant_id ? ` AND attendant_id = $3` : '';
  if (attendant_id) params.push(attendant_id);

  try {
    const [summary, ranking, byProduct, daily] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(amount),0) AS total,
                COALESCE(AVG(amount),0) AS avg_ticket
         FROM sales WHERE sale_date BETWEEN $1 AND $2${extra}`,
        params
      ),
      pool.query(
        `SELECT attendant_id, attendant_name,
                COUNT(*) AS count,
                SUM(amount) AS total,
                AVG(amount) AS avg_ticket
         FROM sales WHERE sale_date BETWEEN $1 AND $2${extra}
         GROUP BY attendant_id, attendant_name ORDER BY total DESC`,
        params
      ),
      pool.query(
        `SELECT product, COUNT(*) AS count, SUM(amount) AS total
         FROM sales WHERE sale_date BETWEEN $1 AND $2${extra}
         GROUP BY product ORDER BY total DESC LIMIT 10`,
        params
      ),
      pool.query(
        `SELECT sale_date::text, COUNT(*) AS count, SUM(amount) AS total
         FROM sales WHERE sale_date BETWEEN $1 AND $2${extra}
         GROUP BY sale_date ORDER BY sale_date`,
        params
      ),
    ]);

    res.json({
      summary: summary.rows[0],
      ranking: ranking.rows,
      by_product: byProduct.rows,
      daily: daily.rows,
      period: { start, end },
    });
  } catch (err) {
    console.error('[dashboard] Erro ao carregar resumo:', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// GET /api/dashboard/my-stats — estatísticas da atendente logada
router.get('/my-stats', requireAuth, async (req, res) => {
  const { period = 'this_month', start_date, end_date } = req.query;
  const { start, end } = resolvePeriod(period, start_date, end_date);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    const [stats, recent, goal] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(amount),0) AS total,
                COALESCE(AVG(amount),0) AS avg_ticket
         FROM sales WHERE attendant_id = $1 AND sale_date BETWEEN $2 AND $3`,
        [req.user.id, start, end]
      ),
      pool.query(
        `SELECT * FROM sales WHERE attendant_id = $1
         ORDER BY sale_date DESC, created_at DESC LIMIT 20`,
        [req.user.id]
      ),
      pool.query(
        `SELECT target_amount FROM sales_goals
         WHERE attendant_id = $1 AND period_month = $2 AND period_year = $3`,
        [req.user.id, month, year]
      ),
    ]);

    res.json({
      stats: stats.rows[0],
      recent_sales: recent.rows,
      goal: goal.rows[0] || null,
      period: { start, end },
    });
  } catch (err) {
    console.error('[dashboard] Erro my-stats:', err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas' });
  }
});

// POST /api/dashboard/goals — definir meta de atendente (admin)
router.post('/goals', requireAuth, requireAdmin, async (req, res) => {
  const { attendant_id, attendant_name, attendant_email, target_amount, period_month, period_year } = req.body;
  if (!attendant_id || !target_amount) {
    return res.status(400).json({ error: 'attendant_id e target_amount são obrigatórios' });
  }
  const now = new Date();
  try {
    const { rows } = await pool.query(
      `INSERT INTO sales_goals
         (attendant_id, attendant_name, attendant_email, target_amount, period_month, period_year)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (attendant_id, period_month, period_year)
       DO UPDATE SET target_amount = EXCLUDED.target_amount, updated_at = NOW()
       RETURNING *`,
      [
        attendant_id,
        attendant_name || '',
        attendant_email || '',
        Number(target_amount),
        period_month || now.getMonth() + 1,
        period_year || now.getFullYear(),
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[dashboard] Erro ao definir meta:', err);
    res.status(500).json({ error: 'Erro ao definir meta' });
  }
});

// GET /api/dashboard/goals — listar metas (admin)
router.get('/goals', requireAuth, requireAdmin, async (req, res) => {
  const now = new Date();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const year = Number(req.query.year) || now.getFullYear();
  try {
    const { rows } = await pool.query(
      `SELECT * FROM sales_goals WHERE period_month = $1 AND period_year = $2`,
      [month, year]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar metas' });
  }
});

module.exports = router;
