const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../database/db');
const router  = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nom, email, password, role, group_id } = req.body;

  if (!nom?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'Tous les champs obligatoires sont requis.' });
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min.).' });
  if (!['student', 'teacher'].includes(role))
    return res.status(400).json({ error: 'Rôle invalide.' });

  const gid  = (role === 'student' && group_id) ? parseInt(group_id) : null;
  const hash = await bcrypt.hash(password, 10);

  try {
    const [result] = await db.execute(
      'INSERT INTO users (nom, email, password, role, group_id) VALUES (?, ?, ?, ?, ?)',
      [nom.trim(), email.toLowerCase().trim(), hash, role, gid]
    );
    res.json({ success: true, id: result.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-mail et mot de passe requis.' });

  try {
    const [rows] = await db.execute(
      'SELECT id, nom, email, password, role, group_id FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Identifiants incorrects.' });

    req.session.user = {
      id: user.id, nom: user.nom, email: user.email,
      role: user.role, group_id: user.group_id
    };
    res.json({ success: true, user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non authentifié' });
  res.json(req.session.user);
});

module.exports = router;
