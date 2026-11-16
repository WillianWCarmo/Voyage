require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { pool, query } = require('./db');

const stops = [
  ['term','Terminal Central',180,230],['centro','Praça Central',180,140],['vilarosa','Vila Rosa',60,90],['avprinc','Av. Principal',240,110],['hosp','Hospital Municipal',300,80],['fatec','Fatec',300,200],['rodo','Rodoviária',100,230],['jdsao','Jardim São Sebastião',70,350],['norte','Jardim Norte',180,40],['parque','Parque Municipal',190,370],['distrito','Distrito Industrial',330,285],['matao','Matão',335,420],
];
const lines = [
  ['201','201','Centro · Vila Rosa','urbana','#0951A0',5.5,['term','centro','vilarosa']],
  ['302','302','Terminal · Jardim São Sebastião','urbana','#F2A900',5.5,['term','rodo','jdsao']],
  ['405','405','Centro · Hospital','urbana','#7B2CFF',5.5,['centro','avprinc','hosp']],
  ['118','118','Fatec · Centro','urbana','#00C9A7',5.5,['fatec','term','centro']],
  ['507','507','Jardim Norte · Parque','urbana','#E5484D',5.5,['norte','centro','term','parque']],
  ['710','710','Taquaritinga · Matão','regional','#192440',12,['term','fatec','distrito','matao']],
];
const passes = [
  ['unico-urbano','unico','urbano','Passe único','Uma viagem dentro da cidade.',5.5,24,1],
  ['diario-urbano','diario','urbano','Passe diário','Viagens ilimitadas por 24 horas.',16,24,null],
  ['mensal-urbano','mensal','urbano','Passe mensal','Mobilidade urbana por 30 dias.',145,720,null],
  ['unico-regional','unico','regional','Passe regional único','Uma viagem entre cidades da região.',12,24,1],
  ['diario-regional','diario','regional','Passe regional diário','Urbano e regional ilimitado por 24 horas.',38,24,null],
  ['mensal-regional','mensal','regional','Passe regional mensal','Mobilidade urbana e regional por 30 dias.',320,720,null],
];

async function main() {
  const schema = fs.readFileSync(path.join(__dirname,'..','database','schema.sql'),'utf8');
  await query(schema);
  for (const [id,name,x,y] of stops) await query('INSERT INTO transit_stops(id,name,x,y) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,x=EXCLUDED.x,y=EXCLUDED.y',[id,name,x,y]);
  for (const [id,code,name,kind,color,fare,stopIds] of lines) await query('INSERT INTO transit_lines(id,code,name,kind,color,fare,stop_ids) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,kind=EXCLUDED.kind,color=EXCLUDED.color,fare=EXCLUDED.fare,stop_ids=EXCLUDED.stop_ids',[id,code,name,kind,color,fare,stopIds]);
  for (const p of passes) await query('INSERT INTO pass_catalog(id,kind,scope,name,description,price,duration_hours,uses) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,scope=EXCLUDED.scope,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,duration_hours=EXCLUDED.duration_hours,uses=EXCLUDED.uses',p);
  console.log('Banco configurado. Tabelas e catálogo básico do Voyage disponíveis.');
}
main().catch(err => { console.error('Falha ao configurar o banco:',err.message); process.exitCode=1; }).finally(async()=>{ await pool.end(); });
