// Capa de acceso a Azure SQL Database (mssql / tedious).
// Configuración por variables de entorno (App Settings del Static Web App):
//   SQL_SERVER   = miserver.database.windows.net
//   SQL_DATABASE = mantenimiento
//   SQL_USER     = usuarioadmin
//   SQL_PASSWORD = ********
const sql = require('mssql');

let poolPromise = null;
function pool(){
  if(!poolPromise){
    poolPromise = new sql.ConnectionPool({
      server: process.env.SQL_SERVER,
      database: process.env.SQL_DATABASE,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
    }).connect();
  }
  return poolPromise;
}
async function q(text, params={}){
  const p = await pool();
  const r = p.request();
  for(const [k,v] of Object.entries(params)) r.input(k, v);
  return (await r.query(text)).recordset || [];
}
const J = v => v==null ? null : JSON.stringify(v);
const P = v => { try{ return v? JSON.parse(v):[]; }catch(e){ return []; } };

// ---- mapeos fila (columnas snake) -> objeto (camel) ----
const uOut = r => ({ id:r.id, username:r.username, name:r.name, role:r.role, mustChange:!!r.must_change });
const tOut = r => ({ id:r.id, code:r.code, name:r.name, category:r.category, brand:r.brand||"", serial:r.serial||"",
  location:r.location||"", assignedTo:r.assigned_to||"", status:r.status||"Operativa",
  lastMonthly:r.last_monthly?String(r.last_monthly).slice(0,10):null,
  lastQuarterly:r.last_quarterly?String(r.last_quarterly).slice(0,10):null,
  monthlyChecklist:P(r.monthly_checklist), quarterlyChecklist:P(r.quarterly_checklist) });
const kOut = r => ({ id:r.id, toolId:r.tool_id, toolCode:r.tool_code, toolName:r.tool_name, userId:r.user_id,
  userName:r.user_name, type:r.type, date:r.date?String(r.date).slice(0,10):null, results:P(r.results), notes:r.notes||"", result:r.result });
const fOut = r => ({ id:r.id, toolId:r.tool_id, toolCode:r.tool_code, toolName:r.tool_name, reportedBy:r.reported_by,
  reportedByName:r.reported_by_name, reportedDate:r.reported_date?String(r.reported_date).slice(0,10):null,
  items:P(r.items), notes:r.notes||"", status:r.status,
  resolvedBy:r.resolved_by, resolvedByName:r.resolved_by_name,
  resolvedDate:r.resolved_date?String(r.resolved_date).slice(0,10):null, resolutionNotes:r.resolution_notes||"" });

module.exports = {
  // usuarios
  async getUsers(){ return (await q('SELECT * FROM dbo.usuarios ORDER BY name')).map(uOut); },
  async getUserAuth(username){ const r=await q('SELECT * FROM dbo.usuarios WHERE username=@u',{u:username}); return r[0]||null; },
  async getUserById(id){ const r=await q('SELECT * FROM dbo.usuarios WHERE id=@i',{i:id}); return r[0]?uOut(r[0]):null; },
  async insertUser(u){ await q(`INSERT INTO dbo.usuarios(id,username,name,role,password_hash,must_change)
      VALUES(@id,@username,@name,@role,@ph,@mc)`,
      {id:u.id,username:u.username,name:u.name,role:u.role,ph:u.passwordHash,mc:u.mustChange?1:0}); },
  async updateUser(u){ await q(`UPDATE dbo.usuarios SET username=@username,name=@name,role=@role WHERE id=@id`,
      {id:u.id,username:u.username,name:u.name,role:u.role}); },
  async setPassword(id,hash,mustChange){ await q('UPDATE dbo.usuarios SET password_hash=@ph, must_change=@mc WHERE id=@i',{i:id,ph:hash,mc:mustChange?1:0}); },
  async deleteUser(id){ await q('DELETE FROM dbo.usuarios WHERE id=@i',{i:id}); },

  // herramientas
  async getTools(){ return (await q('SELECT * FROM dbo.herramientas ORDER BY code')).map(tOut); },
  async upsertTool(t){ await q(`MERGE dbo.herramientas AS d USING (SELECT @id AS id) AS s ON d.id=s.id
      WHEN MATCHED THEN UPDATE SET code=@code,name=@name,category=@category,brand=@brand,serial=@serial,location=@location,
        assigned_to=@assigned_to,status=@status,last_monthly=@lm,last_quarterly=@lq,monthly_checklist=@mc,quarterly_checklist=@qc
      WHEN NOT MATCHED THEN INSERT(id,code,name,category,brand,serial,location,assigned_to,status,last_monthly,last_quarterly,monthly_checklist,quarterly_checklist)
        VALUES(@id,@code,@name,@category,@brand,@serial,@location,@assigned_to,@status,@lm,@lq,@mc,@qc);`,
      {id:t.id,code:t.code,name:t.name,category:t.category,brand:t.brand||"",serial:t.serial||"",location:t.location||"",
       assigned_to:t.assignedTo||null,status:t.status||"Operativa",lm:t.lastMonthly||null,lq:t.lastQuarterly||null,
       mc:J(t.monthlyChecklist),qc:J(t.quarterlyChecklist)}); },
  async deleteTool(id){ await q('DELETE FROM dbo.herramientas WHERE id=@i',{i:id}); },

  // tickets
  async getTickets(){ return (await q('SELECT * FROM dbo.tickets ORDER BY date DESC')).map(kOut); },
  async insertTicket(k){ await q(`INSERT INTO dbo.tickets(id,tool_id,tool_code,tool_name,user_id,user_name,type,date,results,notes,result)
      VALUES(@id,@tool_id,@tool_code,@tool_name,@user_id,@user_name,@type,@date,@results,@notes,@result)`,
      {id:k.id,tool_id:k.toolId,tool_code:k.toolCode,tool_name:k.toolName,user_id:k.userId,user_name:k.userName,
       type:k.type,date:k.date,results:J(k.results),notes:k.notes||"",result:k.result}); },
  // actualiza la herramienta al registrar una revisión (fecha + estado si hay falla)
  async updateToolMaintenance(toolId,type,date,repair){
    const col = type==='mensual' ? 'last_monthly' : 'last_quarterly';
    await q(`UPDATE dbo.herramientas SET ${col}=@d ${repair?", status=N'En reparación'":""} WHERE id=@i`, {i:toolId, d:date||null}); },

  // fallas
  async getFaults(){ return (await q('SELECT * FROM dbo.fallas ORDER BY reported_date DESC')).map(fOut); },
  async insertFault(f){ await q(`INSERT INTO dbo.fallas(id,tool_id,tool_code,tool_name,reported_by,reported_by_name,reported_date,items,notes,status)
      VALUES(@id,@tool_id,@tool_code,@tool_name,@rb,@rbn,@rd,@items,@notes,@status)`,
      {id:f.id,tool_id:f.toolId,tool_code:f.toolCode,tool_name:f.toolName,rb:f.reportedBy,rbn:f.reportedByName,
       rd:f.reportedDate,items:J(f.items),notes:f.notes||"",status:f.status||"abierta"}); },
  async updateFault(f){ await q(`UPDATE dbo.fallas SET status=@status,resolved_by=@rb,resolved_by_name=@rbn,resolved_date=@rd,resolution_notes=@rn WHERE id=@id`,
      {id:f.id,status:f.status,rb:f.resolvedBy||null,rbn:f.resolvedByName||null,rd:f.resolvedDate||null,rn:f.resolutionNotes||null}); },

  // settings
  async getSettings(){ const r=await q('SELECT TOP 1 * FROM dbo.settings'); return r[0]?{company:r[0].company}:{company:"Mi Empresa"}; },
  async upsertSettings(company){ await q(`MERGE dbo.settings AS d USING (SELECT 1 AS id) AS s ON d.id=s.id
      WHEN MATCHED THEN UPDATE SET company=@c WHEN NOT MATCHED THEN INSERT(id,company) VALUES(1,@c);`,{c:company}); }
};
