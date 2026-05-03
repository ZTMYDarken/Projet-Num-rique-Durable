require('dotenv').config();
const mysql = require('mysql2/promise');

// Pool de connexions — Green IT : réutilisation des connexions, pas de reconnexion inutile
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'greentasks',
  waitForConnections: true,
  connectionLimit:    10,       // max 10 connexions simultanées
  queueLimit:         0,
  charset:            'utf8mb4'
});

// Vérification au démarrage
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connecté');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Erreur MySQL :', err.message);
    console.error('→ Vérifiez votre fichier .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)');
  });

module.exports = pool;
