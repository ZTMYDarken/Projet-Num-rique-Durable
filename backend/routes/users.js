// ============================================================
//  routes/users.js — CRUD Utilisateurs + assignation/retrait
//  Fix : LIMIT/OFFSET en template literal (évite ER_WRONG_ARGUMENTS)
// ============================================================
const express = require('express');
const db      = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router  = express.Router();

function toInt(v, def) { const n = parseInt(v, 10); return (Number.isInteger(n) && n >= 1) ? n : def; }

// ── GET /api/users — liste paginée (admin) ───────────────────
// Clé du fix : LIMIT/OFFSET interpolés comme entiers dans le SQL
// car mysql2 peut convertir les ? en string selon le driver version
router.get('/', requireRole('admin'), async (req, res) => {
  const limit  = toInt(req.query.limit, 20);
  const page   = toInt(req.query.page,  1);
  const offset = (page - 1) * limit;

  try {
    // Green IT : SELECT uniquement les colonnes affichées, jamais password
    const [users] = await db.query(
      `SELECT id, nom, email, role, group_id, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`
    );
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM users');
    res.json({ users, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (e) {
    console.error('[GET /api/users]', e.message);
    res.status(500).json({ error: 'Erreur serveur lors du chargement des utilisateurs.' });
  }
});

// ── GET /api/users/unassigned — élèves sans groupe ───────────
router.get('/unassigned', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nom, email
       FROM users
       WHERE role = 'student' AND (group_id IS NULL OR group_id = 0)
       ORDER BY nom`
    );
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/users/unassigned]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── PATCH /api/users/:id/group — assigner OU retirer un élève ─
// Body : { groupId: <int> }  → assigne au groupe
// Body : { groupId: null }   → retire du groupe (group_id = NULL)
router.patch('/:id/group', requireRole('teacher', 'admin'), async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  if (!Number.isInteger(studentId)) return res.status(400).json({ error: 'ID élève invalide.' });

  const groupId = (req.body.groupId !== null && req.body.groupId !== undefined)
    ? parseInt(req.body.groupId, 10) : null;

  try {
    const [[student]] = await db.query(
      'SELECT id, role, group_id FROM users WHERE id = ?', [studentId]
    );
    if (!student) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (student.role !== 'student') return res.status(400).json({ error: 'Cet utilisateur n\'est pas un élève.' });

    // Vérifier propriété du groupe si assignation par un prof (pas admin)
    if (groupId !== null && req.session.user.role !== 'admin') {
      const [[grp]] = await db.query(
        'SELECT id FROM `groups` WHERE id = ? AND teacher_id = ?',
        [groupId, req.session.user.id]
      );
      if (!grp) return res.status(403).json({ error: 'Ce groupe ne vous appartient pas.' });
    }

    // Vérifier propriété du groupe actuel si retrait par un prof
    if (groupId === null && req.session.user.role !== 'admin' && student.group_id) {
      const [[grp]] = await db.query(
        'SELECT id FROM `groups` WHERE id = ? AND teacher_id = ?',
        [student.group_id, req.session.user.id]
      );
      if (!grp) return res.status(403).json({ error: 'Cet élève n\'est pas dans l\'un de vos groupes.' });
    }

    await db.query('UPDATE users SET group_id = ? WHERE id = ?', [groupId, studentId]);
    const msg = groupId ? '✅ Élève assigné au groupe !' : '✅ Élève retiré du groupe.';
    res.json({ success: true, message: msg });
  } catch (e) {
    console.error('[PATCH /api/users/:id/group]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── PUT /api/users/profil — modifier son propre profil ───────
router.put('/profil', requireAuth, async (req, res) => {
  const { nom, group_id } = req.body;
  if (!nom?.trim()) return res.status(400).json({ error: 'Le nom est obligatoire.' });

  const user = req.session.user;
  const gid  = (user.role === 'student' && group_id) ? parseInt(group_id, 10) : user.group_id;

  try {
    await db.query('UPDATE users SET nom = ?, group_id = ? WHERE id = ?', [nom.trim(), gid ?? null, user.id]);
    req.session.user = { ...user, nom: nom.trim(), group_id: gid ?? null };
    res.json({ success: true, user: req.session.user });
  } catch (e) {
    console.error('[PUT /api/users/profil]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── DELETE /api/users/:id — supprimer un utilisateur (admin) ─
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'ID invalide.' });

  try {
    const [[user]] = await db.query('SELECT id, role FROM users WHERE id = ?', [targetId]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Impossible de supprimer un admin.' });

    await db.query('DELETE FROM users WHERE id = ?', [targetId]);
    res.json({ success: true, message: '✅ Utilisateur supprimé.' });
  } catch (e) {
    console.error('[DELETE /api/users/:id]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
