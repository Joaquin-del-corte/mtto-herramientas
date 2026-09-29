// Catálogo base de herramientas y checklists + generador de datos de ejemplo.
const CHECKLIST_BASE = {
  "Manual":        ["Limpieza general","Estado físico / mango","Filo o ajuste correcto","Sin desgaste ni óxido","Accesorios completos"],
  "Eléctrica":     ["Limpieza general","Carcasa sin daños","Cable, enchufe y gatillo","Prueba de funcionamiento","Escobillas / batería","Guardas y accesorios"],
  "Instrumento":   ["Limpieza","Carcasa y pantalla","Puntas / cables de prueba","Prueba de funcionamiento","Estado de batería","Certificado de calibración vigente"],
  "CCTV / Redes":  ["Limpieza","Estado físico","Conectores y puertos","Prueba de funcionamiento","Batería / carga","Software / firmware al día"],
  "Fotovoltaico":  ["Limpieza","Carcasa","Puntas / conectores MC4","Prueba de funcionamiento","Estado de batería","Calibración vigente"],
  "Soldadura":     ["Limpieza","Carcasa y cables","Pinza / porta-electrodo","Prueba de funcionamiento","Careta / filtro","Conexión a tierra"],
  "Seguridad/EPP": ["Limpieza","Integridad física","Sin cortes ni desgaste","Prueba funcional","Etiqueta / certificación vigente"]
};
const EXTRA_TRIM = ["Calibración / verificación de medición","Capacidad real de batería","Ajuste de tornillería y partes móviles","Lubricación","Prueba de continuidad / puesta a tierra","Revisión de certificación y vida útil"];
const RAW_TOOLS = [
  ["HM-01","Pelacables / stripper automático","Manual"],["HM-02","Alicate universal / de corte","Manual"],
  ["HM-03","Ponchadora / crimpadora (RJ45, MC4)","Manual"],["HM-04","Destornilladores aislados 1000V","Manual"],
  ["HM-05","Destornilladores de precisión","Manual"],["HM-06","Juego llaves Allen / Torx","Manual"],
  ["HM-07","Llaves combinadas / dados","Manual"],["HM-08","Llave dinamométrica","Manual"],
  ["HM-09","Cortatubos / dobladora conduit","Manual"],["HM-10","Flexómetro / cinta métrica","Manual"],
  ["HM-11","Nivel láser","Manual"],["HM-12","Sonda pasacables","Manual"],
  ["HE-01","Taladro / atornillador inalámbrico","Eléctrica"],["HE-02","Rotomartillo","Eléctrica"],
  ["HE-03","Amoladora angular","Eléctrica"],["HE-04","Sierra circular / sable","Eléctrica"],
  ["HE-05","Sierra caladora","Eléctrica"],["HE-06","Pistola de calor","Eléctrica"],
  ["HE-07","Aspiradora industrial","Eléctrica"],["HE-08","Cargador y baterías","Eléctrica"],
  ["IN-01","Multímetro digital","Instrumento"],["IN-02","Pinza amperimétrica","Instrumento"],
  ["IN-03","Megóhmetro","Instrumento"],["IN-04","Telurómetro","Instrumento"],
  ["IN-05","Secuencímetro","Instrumento"],["IN-06","Detector de voltaje sin contacto","Instrumento"],
  ["IN-07","Cámara termográfica","Instrumento"],
  ["CR-01","Tester de cámaras CCTV","CCTV / Redes"],["CR-02","Certificador de red UTP","CCTV / Redes"],
  ["CR-03","Ponchadora de impacto","CCTV / Redes"],["CR-04","Localizador de cables (tone)","CCTV / Redes"],
  ["CR-05","Laptop config PLC/HMI","CCTV / Redes"],
  ["FV-01","Crimpadora / llave MC4","Fotovoltaico"],["FV-02","Pinza DC alta tensión","Fotovoltaico"],
  ["FV-03","Trazador de curva I-V","Fotovoltaico"],["FV-04","Solarímetro","Fotovoltaico"],
  ["SO-01","Máquina de soldar MIG/TIG","Soldadura"],["SO-02","Careta fotosensible","Soldadura"],
  ["SO-03","Estación de soldadura / cautín","Soldadura"],["SO-04","Extractor de humo","Soldadura"],
  ["SE-01","Escaleras / andamios","Seguridad/EPP"],["SE-02","Arnés y línea de vida","Seguridad/EPP"],
  ["SE-03","Guantes / botas dieléctricas","Seguridad/EPP"],["SE-04","Kit de bloqueo LOTO","Seguridad/EPP"],
  ["SE-05","Lámparas de trabajo","Seguridad/EPP"]
];

function uid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16);});
}

// Credenciales por defecto (deben cambiarse en el primer ingreso).
const DEFAULT_ADMIN = { username:"admin", password:"Admin1234" };
const DEFAULT_TECH_PASSWORD = "Clave1234";

// Devuelve usuarios (con contraseña en texto plano, para que la API la cifre) y herramientas.
function buildSeed(){
  const admin = { id:uid(), username:DEFAULT_ADMIN.username, name:"Supervisor", role:"admin", password:DEFAULT_ADMIN.password };
  const techsRaw = [["jperez","J. Pérez"],["msoto","M. Soto"],["rlopez","R. López"]];
  const techs = techsRaw.map(([u,n])=>({ id:uid(), username:u, name:n, role:"tecnico", password:DEFAULT_TECH_PASSWORD }));
  const users = [admin, ...techs];
  const techIds = techs.map(t=>t.id);
  const tools = RAW_TOOLS.map((t,i)=>{
    const [code,name,cat]=t; const m=CHECKLIST_BASE[cat].slice();
    return { id:uid(), code, name, category:cat, brand:"", serial:"", location:"Bodega A",
      assignedTo:techIds[i%techIds.length], status:"Operativa", lastMonthly:null, lastQuarterly:null,
      monthlyChecklist:m, quarterlyChecklist:m.concat(EXTRA_TRIM) };
  });
  const dd=(n)=>{const x=new Date();x.setDate(x.getDate()-n);return x.toISOString().slice(0,10);};
  tools[0].lastMonthly=dd(40); tools[0].lastQuarterly=dd(100); tools[0].brand="Klein"; tools[0].serial="SN-0001";
  tools[1].lastMonthly=dd(26); tools[2].lastMonthly=dd(5);
  return { users, tools, settings:{ company:"Mi Empresa" } };
}

module.exports = { CHECKLIST_BASE, EXTRA_TRIM, RAW_TOOLS, uid, buildSeed, DEFAULT_ADMIN, DEFAULT_TECH_PASSWORD };
