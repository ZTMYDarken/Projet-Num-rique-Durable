# 🌿 GreenTasks (MySQL) — TI616 Numérique Durable · EFREI Paris 2025-2026

Application web sobre de gestion de tâches scolaires avec MySQL.

## 🔗 URL déployée
https://greentasks-xl25.onrender.com/

## Membre de l'équipe
| Membre | Rôle respectif |
|---|---|
| Erwan KAAWAR | frontend / backend|
| Ivan LAI | frontend / database / déploiement |
| Tommy LIM | backend / déploiement |
| Anthime L'HERMINE | backend / database |
| Maxime KOBRIN | backend / database |

## Stack technique — justification Green IT
| Technologie | Raison |
|---|---|
| Node.js + Express | Léger, faible empreinte mémoire |
| mysql2 | Driver natif Promise, pool de connexions |
| bcryptjs | Hash sécurisé, pur JS |
| HTML/CSS | 0 framework, 0 requête externe |
| Polices système | 0 appel Google Fonts |
| Dark mode CSS | Réduit la conso OLED |

## Installation locale

### Prérequis
- Node.js
- MySQL (MySQL Server)

```bash
# 1. installer
cd greentasks/backend
npm install

# 2. Créer la base de données
# Ouvrir MySQL Workbench exécuter :
#   database/schema.sql

# 3. Configurer l'environnement
cp .env.example .env
# Remplir DB_HOST, DB_USER, DB_PASSWORD, DB_NAME

# 4. Créer le compte admin manuellement (une seule fois)
node -e "
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('adminadmin', 10));
"
# Copier le hash et l'insérer dans MySQL :
# INSERT INTO users (nom,email,password,role) VALUES ('Admin','admin@greentasks.fr','<HASH>','admin');

# 5. Lancer
npm start
# → http://localhost:3000
```

## Structure
```
greentasks/
├── frontend
    ├── css
        └── style.css
    ├── jss
        └── admin.js · main.js · student.js · teacher.js
    └── dashbord.html · index.html · login.html · register.html
└── backend
    ├── database
        └── db.js · schema.sql
    ├── middleware
        └── auth.js
    ├── routes
        └── auth.js · groups.js · tasks.js · users.js
    ├── server.js
    ├── .env.example / .gitignore
    └──  package-lock.json · package.json · server.js · dump.sql
```

## Indicateurs Green IT cibles
| Indicateur | Objectif |
|---|---|
| Poids total page | ~ 5 Ko |
| Requêtes HTTP / page | < 4 |
| Score EcoIndex | A |
| Score Lighthouse Perf. | > 80 |

## Rapport
https://1drv.ms/w/c/96d8cd63f4978dd5/IQBX-Ix_0ewqSJoI9eu1hJcjAXetYjJyxgAbwEoGr5E9D1M?e=73yVA4