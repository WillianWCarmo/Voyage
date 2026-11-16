require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('SUBSTITUA')) {
  console.error('Defina JWT_SECRET em backend/.env com uma chave aleatória de pelo menos 32 caracteres.');
  process.exit(1);
}

const app = require('./app');

const { pool } = require('./db');

const port = Number(process.env.PORT || 3333);

const host = process.env.HOST || '0.0.0.0';

console.log( `${host} - ${port}`) ;

const server = app.listen(port, host, () => 
  console.log(`[Voyage API] disponível em http://localhost:${port}/api/health`)
);

async function shutdown() {
   console.log('\nEncerrando API...'); 
   server.close(async () => { await pool.end(); process.exit(0); }); 
  }
  
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
