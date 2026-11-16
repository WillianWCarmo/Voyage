const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { query, transaction } = require('./db');

const router = express.Router();
const now = () => Date.now();
const cents = (n) => Math.round(Number(n) * 100) / 100;
const profileSql = `SELECT id, name, usuario, email, avatar_url FROM users WHERE id = $1`;
const safeUser = (row) => ({ id: row.id, name: row.name, usuario: row.usuario, email: row.email, avatar_url: row.avatar_url ?? null });

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new HttpError(status, code, message); };
const requiredString = (value, label, max = 160) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, 'INVALID_INPUT', `${label} inválido.`);
  return value.trim();
};
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d', issuer: 'voyage-local-api', audience: 'voyage-app' });
}
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Entre na sua conta para continuar.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'voyage-local-api', audience: 'voyage-app' });
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sua sessão expirou. Entre novamente.' });
  }
}

async function getState(userId, db = { query }) {
  const [wallet, card, passes, txs, notices, favLines, favRoutes] = await Promise.all([
    db.query('SELECT balance FROM wallets WHERE user_id=$1', [userId]),
    db.query('SELECT number,holder,type,linked_at,status FROM cards WHERE user_id=$1', [userId]),
    db.query(`SELECT op.id,op.pass_id,pc.name,pc.kind,pc.scope,pc.price,op.purchased_at,op.expires_at,op.uses_left,op.expiry_notified FROM owned_passes op JOIN pass_catalog pc ON pc.id=op.pass_id WHERE op.user_id=$1 ORDER BY op.purchased_at DESC`, [userId]),
    db.query('SELECT id,type,title,subtitle,amount,ts FROM transactions WHERE user_id=$1 ORDER BY ts DESC LIMIT 100', [userId]),
    db.query('SELECT id,kind,title,message,ts,"read" AS read FROM notices WHERE user_id=$1 ORDER BY ts DESC LIMIT 100', [userId]),
    db.query('SELECT line_id FROM favorite_lines WHERE user_id=$1 ORDER BY created_at', [userId]),
    db.query('SELECT id,origin_id,dest_id FROM favorite_routes WHERE user_id=$1 ORDER BY created_at DESC', [userId]),
  ]);
  return {
    balance: Number(wallet.rows[0]?.balance || 0),
    card: card.rows[0] ? { number: card.rows[0].number, holder: card.rows[0].holder, type: card.rows[0].type, linkedAt: Number(card.rows[0].linked_at), status: card.rows[0].status } : null,
    passes: passes.rows.map(p => ({ id: p.id, passId: p.pass_id, name: p.name, kind: p.kind, scope: p.scope, price: Number(p.price), purchasedAt: Number(p.purchased_at), expiresAt: Number(p.expires_at), usesLeft: p.uses_left === null ? null : Number(p.uses_left), expiryNotified: p.expiry_notified })),
    txs: txs.rows.map(t => ({ id: t.id, type: t.type, title: t.title, subtitle: t.subtitle, amount: Number(t.amount), ts: Number(t.ts) })),
    notices: notices.rows.map(n => ({ id: n.id, kind: n.kind, title: n.title, message: n.message, ts: Number(n.ts), read: n.read })),
    favLines: favLines.rows.map(r => r.line_id),
    favRoutes: favRoutes.rows.map(r => ({ id: r.id, originId: r.origin_id, destId: r.dest_id })),
  };
}
async function actionResponse(userId, message) { return { message, state: await getState(userId) }; }

router.get('/health', async (req, res, next) => {
  try { await query('SELECT 1'); res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() }); }
  catch (e) { next(e); }
});

router.post('/auth/register', async (req, res, next) => {
  try {
    const name = requiredString(req.body.name, 'Nome', 120);
    const usuario = requiredString(req.body.usuario, 'Usuário', 40).toLowerCase();
    const email = requiredString(req.body.email, 'E-mail', 254).toLowerCase();
    const password = typeof req.body.senha === 'string' ? req.body.senha : '';
    if (password.length < 6 || password.length > 200) fail(400, 'WEAK_PASSWORD', 'A senha deve ter entre 6 e 200 caracteres.');
    if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) fail(400, 'INVALID_USERNAME', 'O usuário deve ter de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.');
    if (!validEmail(email)) fail(400, 'INVALID_EMAIL', 'Informe um endereço de e-mail válido.');
    if (password.length < 6) fail(400, 'WEAK_PASSWORD', 'A senha deve ter pelo menos 6 caracteres.');
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await transaction(async (db) => {
      const user = await db.query('INSERT INTO users(name,usuario,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,usuario,email,avatar_url', [name, usuario, email, passwordHash]);
      await db.query('INSERT INTO wallets(user_id,balance) VALUES($1,0)', [user.rows[0].id]);
      return user.rows[0];
    });
    res.status(201).json({ token: signToken(created), user: safeUser(created) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'USER_ALREADY_EXISTS', message: 'Este e-mail ou nome de usuário já está cadastrado.' });
    next(e);
  }
});
router.post('/auth/login', async (req, res, next) => {
  try {
    const email = requiredString(req.body.email, 'E-mail', 254).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!password || password.length > 200) fail(400, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    const found = await query('SELECT id,name,usuario,email,avatar_url,password_hash FROM users WHERE email=$1', [email]);
    if (!found.rowCount || !(await bcrypt.compare(password, found.rows[0].password_hash))) fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    const user = safeUser(found.rows[0]);
    res.json({ token: signToken(user), user });
  } catch (e) { next(e); }
});
router.get('/voyage/profile', auth, async (req, res, next) => {
  try { const result = await query(profileSql, [req.userId]); if (!result.rowCount) fail(404, 'USER_NOT_FOUND', 'Conta não encontrada.'); res.json(safeUser(result.rows[0])); }
  catch (e) { next(e); }
});
router.patch('/auth/me', auth, async (req, res, next) => {
  try {
    const name = req.body.name === undefined ? undefined : requiredString(req.body.name, 'Nome', 120);
    const email = req.body.email === undefined ? undefined : requiredString(req.body.email, 'E-mail', 254).toLowerCase();
    if (email !== undefined && !validEmail(email)) fail(400, 'INVALID_EMAIL', 'Informe um endereço de e-mail válido.');
    if (name === undefined && email === undefined) fail(400, 'INVALID_INPUT', 'Informe pelo menos um campo para atualizar.');
    const result = await query('UPDATE users SET name=COALESCE($2,name), email=COALESCE($3,email), updated_at=NOW() WHERE id=$1 RETURNING id,name,usuario,email,avatar_url', [req.userId, name ?? null, email ?? null]);
    res.json({ user: safeUser(result.rows[0]) });
  } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'USER_ALREADY_EXISTS', message: 'Este e-mail já está em uso.' }); next(e); }
});
router.get('/voyage/state', auth, async (req, res, next) => { try { res.json(await getState(req.userId)); } catch (e) { next(e); } });
router.get('/voyage/passes', async (req, res, next) => {
  try { const result = await query('SELECT id,kind,scope,name,description,price,duration_hours,uses FROM pass_catalog ORDER BY price'); res.json(result.rows.map(p => ({ ...p, price: Number(p.price), durationHours: p.duration_hours, uses: p.uses === null ? null : Number(p.uses), duration_hours: undefined }))); }
  catch (e) { next(e); }
});
router.put('/voyage/card', auth, async (req, res, next) => {
  try {
    const number = requiredString(req.body.number, 'Número do cartão', 32).replace(/\s/g, '');
    const holder = requiredString(req.body.holder, 'Titular', 120);
    const type = requiredString(req.body.type, 'Tipo', 20);
    if (!/^[0-9A-Za-z-]{6,32}$/.test(number)) fail(400, 'INVALID_CARD', 'Número de cartão inválido.');
    if (!['comum','estudante','vale'].includes(type)) fail(400, 'INVALID_CARD_TYPE', 'Tipo de cartão inválido.');
    await query(`INSERT INTO cards(user_id,number,holder,type,linked_at,status) VALUES($1,$2,$3,$4,$5,'ativo') ON CONFLICT(user_id) DO UPDATE SET number=EXCLUDED.number,holder=EXCLUDED.holder,type=EXCLUDED.type,linked_at=EXCLUDED.linked_at,status='ativo'`, [req.userId, number, holder, type, now()]);
    res.json(await actionResponse(req.userId, 'Cartão vinculado com sucesso.'));
  } catch (e) { next(e); }
});
router.post('/voyage/card/virtual', auth, async (req, res, next) => {
  try {
    const holder = requiredString(req.body.holder, 'Titular', 120);
    const type = requiredString(req.body.type, 'Tipo', 20);
    if (!['comum','estudante','vale'].includes(type)) fail(400, 'INVALID_CARD_TYPE', 'Tipo de cartão inválido.');
    const number = `VY${crypto.randomInt(1000000000, 9999999999)}`;
    await query(`INSERT INTO cards(user_id,number,holder,type,linked_at,status) VALUES($1,$2,$3,$4,$5,'ativo') ON CONFLICT(user_id) DO UPDATE SET number=EXCLUDED.number,holder=EXCLUDED.holder,type=EXCLUDED.type,linked_at=EXCLUDED.linked_at,status='ativo'`, [req.userId, number, holder, type, now()]);
    res.status(201).json(await actionResponse(req.userId, 'Cartão virtual criado com sucesso.'));
  } catch (e) { next(e); }
});
router.delete('/voyage/card', auth, async (req, res, next) => { try { await query('DELETE FROM cards WHERE user_id=$1', [req.userId]); res.json(await actionResponse(req.userId, 'Cartão removido.')); } catch (e) { next(e); } });
router.post('/voyage/wallet/recharge', auth, async (req, res, next) => {
  try {
    const amount = cents(req.body.amount);
    const method = requiredString(req.body.method, 'Método', 20);
    if (!Number.isFinite(amount) || amount < 5 || amount > 500) fail(400, 'INVALID_AMOUNT', 'O valor deve estar entre R$ 5,00 e R$ 500,00.');
    if (!['pix','credito','debito'].includes(method)) fail(400, 'INVALID_METHOD', 'Método de pagamento inválido.');
    await transaction(async (db) => {
      await db.query('UPDATE wallets SET balance=balance+$2,updated_at=NOW() WHERE user_id=$1', [req.userId, amount]);
      await db.query('INSERT INTO transactions(user_id,type,title,subtitle,amount,ts) VALUES($1,\'recarga\',$2,$3,$4,$5)', [req.userId, 'Recarga de carteira', `Pagamento demonstrativo · ${method}`, amount, now()]);
      await db.query('INSERT INTO notices(user_id,kind,title,message,ts) VALUES($1,\'recarga\',$2,$3,$4)', [req.userId, 'Recarga realizada', `Sua recarga demonstrativa de R$ ${amount.toFixed(2)} foi adicionada.`, now()]);
    });
    res.json(await actionResponse(req.userId, 'Recarga demonstrativa realizada. Nenhuma cobrança real foi feita.'));
  } catch (e) { next(e); }
});
router.post('/voyage/passes/purchase', auth, async (req, res, next) => {
  try {
    const passId = requiredString(req.body.passId, 'Passe', 60);
    const result = await transaction(async (db) => {
      const catalog = await db.query('SELECT * FROM pass_catalog WHERE id=$1', [passId]);
      if (!catalog.rowCount) fail(404, 'PASS_NOT_FOUND', 'Passe não encontrado.');
      const pass = catalog.rows[0];
      const wallet = await db.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [req.userId]);
      if (Number(wallet.rows[0]?.balance || 0) < Number(pass.price)) fail(400, 'INSUFFICIENT_BALANCE', 'Saldo insuficiente para comprar este passe.');
      const purchasedAt = now();
      await db.query('UPDATE wallets SET balance=balance-$2,updated_at=NOW() WHERE user_id=$1', [req.userId, pass.price]);
      await db.query('INSERT INTO owned_passes(user_id,pass_id,purchased_at,expires_at,uses_left) VALUES($1,$2,$3,$4,$5)', [req.userId, passId, purchasedAt, purchasedAt + Number(pass.duration_hours) * 3600000, pass.uses]);
      await db.query('INSERT INTO transactions(user_id,type,title,subtitle,amount,ts) VALUES($1,\'passe\',$2,$3,$4,$5)', [req.userId, `Compra: ${pass.name}`, pass.scope === 'regional' ? 'Passe regional' : 'Passe urbano', -Number(pass.price), purchasedAt]);
      await db.query('INSERT INTO notices(user_id,kind,title,message,ts) VALUES($1,\'passe\',$2,$3,$4)', [req.userId, 'Passe ativado', `${pass.name} foi adicionado à sua conta.`, purchasedAt]);
    });
    res.json(await actionResponse(req.userId, 'Passe comprado e ativado com sucesso.'));
  } catch (e) { next(e); }
});
router.post('/voyage/transit/board', auth, async (req, res, next) => {
  try {
    const lineId = requiredString(req.body.lineId, 'Linha', 60);
    await transaction(async (db) => {
      const lineResult = await db.query('SELECT * FROM transit_lines WHERE id=$1', [lineId]);
      if (!lineResult.rowCount) fail(404, 'LINE_NOT_FOUND', 'Linha não encontrada.');
      const line = lineResult.rows[0];
      const passes = await db.query(`SELECT op.id,op.pass_id,op.uses_left,op.expires_at,pc.scope,pc.kind FROM owned_passes op JOIN pass_catalog pc ON pc.id=op.pass_id WHERE op.user_id=$1 AND op.expires_at>$2 AND (op.uses_left IS NULL OR op.uses_left>0) ORDER BY op.expires_at ASC FOR UPDATE OF op`, [req.userId, now()]);
      const validPass = passes.rows.find(p => p.scope === 'regional' || line.kind === 'urbana');
      let charged = Number(line.fare);
      if (validPass) {
        charged = 0;
        if (validPass.uses_left !== null) await db.query('UPDATE owned_passes SET uses_left=uses_left-1 WHERE id=$1', [validPass.id]);
      } else {
        const wallet = await db.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [req.userId]);
        if (Number(wallet.rows[0]?.balance || 0) < charged) fail(400, 'INSUFFICIENT_BALANCE', 'Saldo insuficiente para embarcar.');
        await db.query('UPDATE wallets SET balance=balance-$2,updated_at=NOW() WHERE user_id=$1', [req.userId, charged]);
      }
      const ts = now();
      await db.query('INSERT INTO transactions(user_id,type,title,subtitle,amount,ts) VALUES($1,\'viagem\',$2,$3,$4,$5)', [req.userId, `Embarque · ${line.code}`, line.name, -charged, ts]);
      await db.query('INSERT INTO notices(user_id,kind,title,message,ts) VALUES($1,\'transporte\',$2,$3,$4)', [req.userId, 'Embarque registrado', `Embarque na linha ${line.code} registrado.`, ts]);
    });
    res.json(await actionResponse(req.userId, 'Embarque registrado com sucesso.'));
  } catch (e) { next(e); }
});
router.post('/voyage/favorites/lines/toggle', auth, async (req, res, next) => {
  try {
    const lineId = requiredString(req.body.lineId, 'Linha', 60);
    const exists = await query('SELECT 1 FROM transit_lines WHERE id=$1', [lineId]);
    if (!exists.rowCount) fail(404, 'LINE_NOT_FOUND', 'Linha não encontrada.');
    const current = await query('SELECT 1 FROM favorite_lines WHERE user_id=$1 AND line_id=$2', [req.userId,lineId]);
    if (current.rowCount) await query('DELETE FROM favorite_lines WHERE user_id=$1 AND line_id=$2', [req.userId,lineId]);
    else await query('INSERT INTO favorite_lines(user_id,line_id) VALUES($1,$2)', [req.userId,lineId]);
    res.json(await actionResponse(req.userId, 'Favoritos atualizados.'));
  } catch (e) { next(e); }
});
router.post('/voyage/favorites/routes', auth, async (req, res, next) => {
  try {
    const originId = requiredString(req.body.originId, 'Origem', 60);
    const destId = requiredString(req.body.destId, 'Destino', 60);
    if (originId === destId) fail(400, 'INVALID_ROUTE', 'Origem e destino devem ser diferentes.');
    const result = await query('INSERT INTO favorite_routes(user_id,origin_id,dest_id) VALUES($1,$2,$3) ON CONFLICT(user_id,origin_id,dest_id) DO NOTHING', [req.userId,originId,destId]);
    res.status(201).json(await actionResponse(req.userId, 'Rota favorita salva.'));
  } catch (e) { next(e); }
});
router.delete('/voyage/favorites/routes/:id', auth, async (req, res, next) => { try { await query('DELETE FROM favorite_routes WHERE id=$1 AND user_id=$2', [req.params.id,req.userId]); res.json(await actionResponse(req.userId, 'Rota favorita removida.')); } catch (e) { next(e); } });
router.post('/voyage/notices/read-all', auth, async (req, res, next) => { try { await query('UPDATE notices SET "read"=TRUE WHERE user_id=$1', [req.userId]); res.json(await actionResponse(req.userId, 'Avisos marcados como lidos.')); } catch (e) { next(e); } });

router.get('/public/news', async (req, res, next) => { try { const r = await query('SELECT id,title AS titulo,author AS autor,summary,content AS conteudo,image AS imagem_url,published_at AS created_at FROM news ORDER BY published_at DESC'); res.json(r.rows); } catch (e) { next(e); } });
router.get('/public/news/:id', async (req, res, next) => { try { const r = await query('SELECT id,title AS titulo,author AS autor,summary,content AS conteudo,image AS imagem_url,published_at AS created_at FROM news WHERE id=$1', [req.params.id]); if (!r.rowCount) fail(404,'NEWS_NOT_FOUND','Notícia não encontrada.'); res.json(r.rows[0]); } catch (e) { next(e); } });
router.get('/public/partners', async (req, res, next) => { try { const r = await query('SELECT id,name AS nome,description AS descricao,logo AS logo_url,url AS site_url FROM partners ORDER BY name'); res.json(r.rows); } catch (e) { next(e); } });
router.get('/public/regions', async (req, res, next) => { try { const r = await query('SELECT id,name AS nome,description AS descricao,image AS imagem_url FROM regions ORDER BY name'); res.json(r.rows); } catch (e) { next(e); } });
router.get('/public/transit', async (req, res, next) => {
  try {
    const [stops, lines] = await Promise.all([query('SELECT id,name,x,y FROM transit_stops ORDER BY name'), query('SELECT id,code,name,kind,color,fare,stop_ids FROM transit_lines ORDER BY code')]);
    res.json({ stops: stops.rows.map(s => ({ ...s, x: Number(s.x), y: Number(s.y) })), lines: lines.rows.map(l => ({ id:l.id,code:l.code,name:l.name,kind:l.kind,color:l.color,fare:Number(l.fare),stopIds:l.stop_ids })) });
  } catch (e) { next(e); }
});
router.get('/public/buses', async (req, res, next) => { try { const r = await query('SELECT id,"line_id" AS "lineId",dist,dir,speed FROM transit_buses ORDER BY id'); res.json(r.rows.map(b => ({ ...b, dist:Number(b.dist),dir:Number(b.dir),speed:Number(b.speed) }))); } catch (e) { next(e); } });

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || '').split(',').map(s=>s.trim()).filter(Boolean), allowedHeaders:['Content-Type','Authorization'], methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => { req.body = req.body || {}; next(); });
app.use('/api/admin', (req,res) => res.status(403).json({ error:'ADMIN_DISABLED', message:'O painel administrativo está desativado nesta versão.' }));
app.use('/api', router);
app.use((req,res) => res.status(404).json({ error:'NOT_FOUND', message:'Rota não encontrada.' }));
app.use((err,req,res,next) => {
  if (res.headersSent) return next(err);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) return res.status(400).json({ error:'INVALID_JSON', message:'O corpo da requisição contém JSON inválido.' });
  if (err instanceof HttpError) return res.status(err.status).json({ error:err.code, message:err.message });
  if (err.code === '23503') return res.status(400).json({ error:'INVALID_REFERENCE', message:'O item informado não existe.' });
  if (err.code === '23505') return res.status(409).json({ error:'CONFLICT', message:'Este registro já existe.' });
  console.error('[Voyage API]', err);
  return res.status(500).json({ error:'INTERNAL_ERROR', message:'Ocorreu um erro interno. Tente novamente.' });
});
module.exports = app;
