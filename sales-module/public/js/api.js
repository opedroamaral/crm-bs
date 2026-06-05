const API = '/api';

function getToken() { return localStorage.getItem('crm_token'); }
function setToken(t) { localStorage.setItem('crm_token', t); }
function removeToken() { localStorage.removeItem('crm_token'); }

function getUser() {
  const t = getToken();
  if (!t) return null;
  try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; }
}

async function api(method, path, body) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) {
    removeToken();
    if (!location.pathname.includes('login')) location.href = '/login.html';
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

function brl(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
}

function fdate(d) {
  if (!d) return '—';
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR');
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function guardLogin() {
  if (!getToken()) { location.href = '/login.html'; return false; }
  return true;
}

function guardAdmin() {
  const u = getUser();
  if (!u || u.role !== 'administrator') { location.href = '/my-sales.html'; return false; }
  return true;
}
