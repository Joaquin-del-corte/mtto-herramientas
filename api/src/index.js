// API de Mantenimiento — Azure Functions (modelo v4, Node 18+).
// Autenticación propia: usuario + contraseña (bcrypt) y token JWT.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { buildSeed, uid } = require('./catalog');

const dal = global.__DAL || require('./dal');
const SECRET = process.env.JWT_SECRET || 'CAMBIA_ESTE_SECRETO_EN_AZURE';

// ---------- helpers ----------
const json = (status, body) => ({ status, headers:{'Content-Type':'application/json'}, jsonBody: body });
async function body(request){ try{ return await request.json(); }catch(e){ return {}; } }
function bearer(request){
  const h = (request.headers.get ? request.headers.get('authorization') : request.headers['authorization']) || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
function auth(request){
  const tok = bearer(request); if(!tok) return null;
  try{ return jwt.verify(tok, SECRET); }catch(e){ return null; }
}
const ok = u => !!u;
const isAdmin = u => u && u.role === 'admin';

// Crea admin + datos de ejemplo si la base está vacía.
async function seedIfEmpty(){
  const users = await dal.getUsers();
  if(users.length > 0) return;
  const seed = buildSeed();
  for(const u of seed.users){
    await dal.insertUser({ id:u.id, username:u.username, name:u.name, role:u.role,
      passwordHash: bcrypt.hashSync(u.password, 10), mustChange:true });
  }
  for(const t of seed.tools) await dal.upsertTool(t);
  await dal.upsertSettings(seed.settings.company);
}

// ---------- handlers ----------
const handlers = {
  async login(request){
    const b = await body(request);
    const username = (b.username||'').trim().toLowerCase();
    const password = b.password||'';
    if(!username || !password) return json(400, {error:'Faltan credenciales.'});
    await seedIfEmpty();
    const row = await dal.getUserAuth(username);
    if(!row || !bcrypt.compareSync(password, row.password_hash))
      return json(401, {error:'Usuario o contraseña incorrectos.'});
    const user = { id:row.id, name:row.name, role:row.role, username:row.username };
    const token = jwt.sign(user, SECRET, { expiresIn:'30d' });
    return json(200, { token, user, mustChange: !!row.must_change });
  },

  async data(request){
    if(!ok(auth(request))) return json(401, {error:'No autorizado.'});
    await seedIfEmpty();
    const [users, tools, tickets, faults, settings] = await Promise.all([
      dal.getUsers(), dal.getTools(), dal.getTickets(), dal.getFaults(), dal.getSettings()
    ]);
    return json(200, { users, tools, tickets, faults, settings });
  },

  async upsertTool(request){
    if(!isAdmin(auth(request))) return json(403, {error:'Solo el supervisor.'});
    const t = await body(request);
    if(!t.id || !t.code || !t.name) return json(400, {error:'Datos incompletos.'});
    await dal.upsertTool(t); return json(200, {ok:true});
  },
  async deleteTool(request){
    if(!isAdmin(auth(request))) return json(403, {error:'Solo el supervisor.'});
    const { id } = await body(request); if(!id) return json(400,{error:'Falta id.'});
    await dal.deleteTool(id); return json(200, {ok:true});
  },

  async upsertUser(request){
    if(!isAdmin(auth(request))) return json(403, {error:'Solo el supervisor.'});
    const u = await body(request);
    if(!u.name || !u.username) return json(400, {error:'Nombre y usuario obligatorios.'});
    u.username = u.username.trim().toLowerCase();
    const existing = u.id ? await dal.getUserById(u.id) : null;
    if(!existing){
      const id = u.id || uid();
      const pw = u.password || 'Clave1234';
      await dal.insertUser({ id, username:u.username, name:u.name, role:u.role||'tecnico',
        passwordHash: bcrypt.hashSync(pw, 10), mustChange:true });
      return json(200, {ok:true, id});
    } else {
      await dal.updateUser({ id:u.id, username:u.username, name:u.name, role:u.role||'tecnico' });
      if(u.password) await dal.setPassword(u.id, bcrypt.hashSync(u.password,10), true);
      return json(200, {ok:true, id:u.id});
    }
  },
  async deleteUser(request){
    if(!isAdmin(auth(request))) return json(403, {error:'Solo el supervisor.'});
    const { id } = await body(request); if(!id) return json(400,{error:'Falta id.'});
    await dal.deleteUser(id); return json(200, {ok:true});
  },
  async changePassword(request){
    const me = auth(request); if(!ok(me)) return json(401,{error:'No autorizado.'});
    const b = await body(request);
    const targetId = b.id || me.id;
    if(targetId !== me.id && !isAdmin(me)) return json(403, {error:'No puedes cambiar la clave de otro.'});
    if(!b.newPassword || b.newPassword.length < 6) return json(400, {error:'La clave debe tener al menos 6 caracteres.'});
    await dal.setPassword(targetId, bcrypt.hashSync(b.newPassword, 10), false);
    return json(200, {ok:true});
  },

  async insertTicket(request){
    if(!ok(auth(request))) return json(401,{error:'No autorizado.'});
    const k = await body(request); if(!k.id || !k.toolId) return json(400,{error:'Datos incompletos.'});
    await dal.insertTicket(k);
    // El servidor actualiza la herramienta (fecha de revisión y estado si hay falla).
    await dal.updateToolMaintenance(k.toolId, k.type, k.date, k.result === 'REVISAR');
    return json(200, {ok:true});
  },
  async insertFault(request){
    if(!ok(auth(request))) return json(401,{error:'No autorizado.'});
    const f = await body(request); if(!f.id || !f.toolId) return json(400,{error:'Datos incompletos.'});
    await dal.insertFault(f); return json(200, {ok:true});
  },
  async updateFault(request){
    if(!ok(auth(request))) return json(401,{error:'No autorizado.'});
    const f = await body(request); if(!f.id) return json(400,{error:'Falta id.'});
    await dal.updateFault(f); return json(200, {ok:true});
  },
  async settings(request){
    if(!isAdmin(auth(request))) return json(403, {error:'Solo el supervisor.'});
    const { company } = await body(request);
    await dal.upsertSettings(company||''); return json(200, {ok:true});
  }
};

// ---------- registro de rutas (solo dentro de Azure Functions) ----------
try {
  const { app } = require('@azure/functions');
  const POST = (name, route, h) => app.http(name, { methods:['POST'], authLevel:'anonymous', route, handler:h });
  const GET  = (name, route, h) => app.http(name, { methods:['GET'],  authLevel:'anonymous', route, handler:h });
  POST('login','login', handlers.login);
  GET ('data','data', handlers.data);
  POST('upsertTool','tool', handlers.upsertTool);
  POST('deleteTool','tool/delete', handlers.deleteTool);
  POST('upsertUser','user', handlers.upsertUser);
  POST('deleteUser','user/delete', handlers.deleteUser);
  POST('changePassword','user/password', handlers.changePassword);
  POST('insertTicket','ticket', handlers.insertTicket);
  POST('insertFault','fault', handlers.insertFault);
  POST('updateFault','fault/update', handlers.updateFault);
  POST('settings','settings', handlers.settings);
} catch (e) { /* fuera de Azure (tests): se usan los handlers directamente */ }

module.exports = { handlers, seedIfEmpty };
