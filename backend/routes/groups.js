// ============================================================
//  routes/groups.js — CRUD Groupes + liste tâches du groupe
//  Fix : LIMIT/OFFSET interpolés (évite ER_WRONG_ARGUMENTS)
// ============================================================
const express = require('express');
const db      = require('../database/db');
const { requireRole } = require('../middleware/auth');
const router  = express.Router();

function toInt(v, def) { const n = parseInt(v, 10); return (Number.isInteger(n) && n >= 1) ? n : def; }

// ── GET /api/groups — liste publique (inscription) ───────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT g.id, g.name, u.nom AS teacher
       FROM \`groups\` g
       JOIN users u ON g.teacher_id = u.id
       ORDER BY g.name`
    );
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/groups]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── GET /api/groups/my-groups — groupes du prof connecté ─────
router.get('/my-groups', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT g.id, g.name, g.created_at,
         (SELECT COUNT(*) FROM users WHERE group_id = g.id AND role = 'student') AS nb_students,
         (SELECT COUNT(*) FROM tasks  WHERE group_id = g.id) AS nb_tasks
       FROM \`groups\` g
       WHERE g.teacher_id = ?
       ORDER BY g.created_at DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/groups/my-groups]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── GET /api/groups/unassigned-students ──────────────────────
router.get('/unassigned-students', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nom, email
       FROM users
       WHERE role = 'student' AND (group_id IS NULL OR group_id = 0)
       ORDER BY nom`
    );
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/groups/unassigned-students]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── GET /api/groups/:id/tasks — tâches du groupe (prof) ──────
router.get('/:id/tasks', requireRole('teacher', 'admin'), async (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: 'ID groupe invalide.' });

  const limit  = toInt(req.query.limit, 20);
  const page   = toInt(req.query.page,  1);
  const offset = (page - 1) * limit;

  try {
    // Vérifier propriété du groupe
    const [[grp]] = await db.query(
      'SELECT id FROM `groups` WHERE id = ? AND teacher_id = ?',
      [groupId, req.session.user.id]
    );
    if (!grp && req.session.user.role !== 'admin')
      return res.status(403).json({ error: 'Accès refusé.' });

    const [tasks] = await db.query(
      `SELECT t.id, t.title, t.description, t.status, t.due_date,
              t.feedback, t.feedback_comment, t.feedback_at,
              t.created_at, u.nom AS student_nom, u.id AS student_id
       FROM tasks t
       JOIN users u ON t.student_id = u.id
       WHERE t.group_id = ?
       ORDER BY t.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [groupId]
    );
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM tasks WHERE group_id = ?', [groupId]
    );
    res.json({ tasks, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (e) {
    console.error('[GET /api/groups/:id/tasks]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── GET /api/groups/:id/students — élèves du groupe ──────────
router.get('/:id/students', requireRole('teacher', 'admin'), async (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: 'ID groupe invalide.' });

  try {
    const [[grp]] = await db.query(
      'SELECT id FROM `groups` WHERE id = ? AND teacher_id = ?',
      [groupId, req.session.user.id]
    );
    if (!grp && req.session.user.role !== 'admin')
      return res.status(403).json({ error: 'Accès refusé.' });

    const [students] = await db.query(
      `SELECT id, nom, email FROM users WHERE group_id = ? AND role = 'student' ORDER BY nom`,
      [groupId]
    );
    res.json(students);
  } catch (e) {
    console.error('[GET /api/groups/:id/students]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── POST /api/groups — créer un groupe ───────────────────────
router.post('/', requireRole('teacher', 'admin'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom du groupe requis.' });

  try {
    const [result] = await db.query(
      'INSERT INTO `groups` (name, teacher_id) VALUES (?, ?)',
      [name.trim(), req.session.user.id]
    );
    res.json({ success: true, id: result.insertId, message: '✅ Groupe créé !' });
  } catch (e) {
    console.error('[POST /api/groups]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── DELETE /api/groups/:id — supprimer un groupe ─────────────
router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: 'ID invalide.' });

  try {
    const [[grp]] = await db.query(
      'SELECT id FROM `groups` WHERE id = ? AND teacher_id = ?',
      [groupId, req.session.user.id]
    );
    if (!grp && req.session.user.role !== 'admin')
      return res.status(403).json({ error: 'Accès refusé.' });

    await db.query('DELETE FROM `groups` WHERE id = ?', [groupId]);
    res.json({ success: true, message: '✅ Groupe supprimé.' });
  } catch (e) {
    console.error('[DELETE /api/groups/:id]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
