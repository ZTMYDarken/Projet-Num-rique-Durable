// ============================================================
//  routes/tasks.js — CRUD Tâches + Feedback enseignant
//  Fix : parseInt() strict sur LIMIT/OFFSET (mysql2 exige Number)
// ============================================================
const express = require('express');
const db      = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router  = express.Router();

const VALID_STATUS   = ['todo', 'doing', 'done'];
const VALID_FEEDBACK = ['approved', 'partial', 'rejected'];

// Utilitaire : convertit en entier positif, jamais NaN/string
function toInt(v, def) { const n = parseInt(v, 10); return (Number.isInteger(n) && n >= 1) ? n : def; }

// ── GET /api/tasks/my-tasks — tâches de l'élève ──────────────
router.get('/my-tasks', requireAuth, async (req, res) => {
  const user = req.session.user;
  if (!user.group_id) {
    return res.status(403).json({ error: 'Demandez à votre professeur de vous ajouter à un groupe.' });
  }

  // mysql2 exige des Number purs pour LIMIT/OFFSET
  const limit  = toInt(req.query.limit, 20);
  const page   = toInt(req.query.page,  1);
  const offset = (page - 1) * limit;

  const status      = VALID_STATUS.includes(req.query.status) ? req.query.status : null;
  const whereSQL    = status ? 'student_id = ? AND status = ?' : 'student_id = ?';
  const whereParams = status ? [user.id, status]               : [user.id];

  try {
    // Colonnes exactes affichées dans le frontend — pas de SELECT *
    const [tasks] = await db.query(
      `SELECT id, title, description, status, due_date,
              feedback, feedback_comment, feedback_at, created_at
       FROM tasks
       WHERE ${whereSQL}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      whereParams
    );
    // COUNT séparé pour la pagination
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM tasks WHERE ${whereSQL}`,
      whereParams
    );
    res.json({ tasks, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (e) {
    console.error('[GET /my-tasks]', e.message);
    res.status(500).json({ error: 'Erreur serveur lors du chargement des tâches.' });
  }
});

// ── POST /api/tasks — créer une tâche ────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const user = req.session.user;
  if (!user.group_id) {
    return res.status(403).json({ error: 'Demandez à votre professeur de vous ajouter à un groupe.' });
  }

  const { title, description, status, due_date } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Le titre est obligatoire.' });

  const s = VALID_STATUS.includes(status) ? status : 'todo';

  try {
    const [result] = await db.query(
      `INSERT INTO tasks (title, description, status, due_date, student_id, group_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title.trim(), (description || '').trim(), s, due_date || null, user.id, user.group_id]
    );
    res.json({ success: true, id: result.insertId, message: '✅ Tâche ajoutée avec succès !' });
  } catch (e) {
    console.error('[POST /tasks]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── PUT /api/tasks/:id — modifier une tâche (élève) ──────────
router.put('/:id', requireAuth, async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (!Number.isInteger(taskId)) return res.status(400).json({ error: 'ID invalide.' });

  const user = req.session.user;
  if (!user.group_id) {
    return res.status(403).json({ error: 'Demandez à votre professeur de vous ajouter à un groupe.' });
  }

  try {
    const [[task]] = await db.query(
      'SELECT id, status FROM tasks WHERE id = ? AND student_id = ?',
      [taskId, user.id]
    );
    if (!task) return res.status(403).json({ error: 'Tâche introuvable ou accès refusé.' });

    const { title, description, status, due_date } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Le titre est obligatoire.' });

    const s = VALID_STATUS.includes(status) ? status : task.status;

    await db.query(
      `UPDATE tasks SET title = ?, description = ?, status = ?, due_date = ?,
              feedback = NULL, feedback_comment = NULL, feedback_at = NULL
       WHERE id = ?`,
      [title.trim(), (description || '').trim(), s, due_date || null, taskId]
    );
    res.json({ success: true, message: '✅ Tâche modifiée avec succès !' });
  } catch (e) {
    console.error('[PUT /tasks/:id]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── DELETE /api/tasks/:id — supprimer une tâche ──────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (!Number.isInteger(taskId)) return res.status(400).json({ error: 'ID invalide.' });

  const user = req.session.user;
  try {
    const [[task]] = await db.query('SELECT student_id FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
    if (task.student_id !== user.id && user.role !== 'admin')
      return res.status(403).json({ error: 'Accès refusé.' });

    await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.json({ success: true, message: 'Tâche supprimée.' });
  } catch (e) {
    console.error('[DELETE /tasks/:id]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── PATCH /api/tasks/:id/feedback — feedback enseignant ───────
// Accessible aux enseignants propriétaires du groupe + admin
router.patch('/:id/feedback', requireRole('teacher', 'admin'), async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (!Number.isInteger(taskId)) return res.status(400).json({ error: 'ID invalide.' });

  const { feedback, feedback_comment } = req.body;
  if (!VALID_FEEDBACK.includes(feedback))
    return res.status(400).json({ error: 'Feedback invalide (approved / partial / rejected).' });

  try {
    // Vérifier que le prof possède le groupe de cette tâche
    const [[task]] = await db.query(
      `SELECT t.id, t.group_id, g.teacher_id
       FROM tasks t
       JOIN \`groups\` g ON t.group_id = g.id
       WHERE t.id = ?`,
      [taskId]
    );
    if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
    if (req.session.user.role !== 'admin' && task.teacher_id !== req.session.user.id)
      return res.status(403).json({ error: 'Cette tâche n\'appartient pas à l\'un de vos groupes.' });

    await db.query(
      `UPDATE tasks
       SET feedback = ?, feedback_comment = ?, feedback_at = NOW()
       WHERE id = ?`,
      [feedback, (feedback_comment || '').trim() || null, taskId]
    );

    const labels = { approved: '✅ Validée', partial: '⚠️ Partiellement validée', rejected: '❌ Refusée' };
    res.json({ success: true, message: `Tâche marquée : ${labels[feedback]}` });
  } catch (e) {
    console.error('[PATCH /tasks/:id/feedback]', e.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
