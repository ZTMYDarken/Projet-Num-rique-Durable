// ============================================================
//  js/main.js — Fonctions communes et Initialisation
// ============================================================
'use strict';

// ── Constantes UI (Badge, Couleurs, Libellés) ────────────────
const STATUS_LABEL = { todo:'À faire', doing:'En cours', done:'Terminé' };
const STATUS_CLS   = { todo:'b-todo', doing:'b-doing', done:'b-done' };
const FB_LABEL     = { approved:'✅ Validée', partial:'⚠️ Partielle', rejected:'❌ Refusée' };
const FB_CLS       = { approved:'fb-approved', partial:'fb-partial', rejected:'fb-rejected' };
const ROLE_LABEL   = { student:'Élève', teacher:'Enseignant', admin:'Admin' };
const ROLE_CLS     = { student:'b-todo', teacher:'b-doing', admin:'b-done' };

// ── État global ───────────────────────────────────────────────
let ME = null; 

// ── Utilitaires d'Affichage ───────────────────────────────────
function badge(label, cls) { return `<span class="badge ${cls}">${label}</span>`; }
function statusBadge(s)    { return badge(STATUS_LABEL[s]||s, STATUS_CLS[s]||''); }
function feedbackBadge(f)  { return f ? badge(FB_LABEL[f]||f, FB_CLS[f]||'') : '<span class="muted" style="font-size:.82rem">—</span>'; }
function roleBadge(r)      { return badge(ROLE_LABEL[r]||r, ROLE_CLS[r]||''); }

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, j] = d.split('T')[0].split('-');
  return `${j}/${m}/${y}`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ── Communication API ────────────────────────────────────────
async function api(url, opts = {}) {
  const res  = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// ── Gestion de l'Interface (Modaux, Toasts) ──────────────────
function toast(msg, isErr = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'show' + (isErr ? ' err' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function showErr(id, msg)  { const e=document.getElementById(id); if(e){ e.textContent=msg; e.classList.remove('hidden'); } }
function hideErr(id)       { const e=document.getElementById(id); if(e) e.classList.add('hidden'); }
function openModal(id)     { const e=document.getElementById(id); if(e) e.classList.remove('hidden'); }
function closeModal(id)    { const e=document.getElementById(id); if(e) e.classList.add('hidden'); }

// Fermer modaux en cliquant le fond
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if(e.target===m) closeModal(m.id); });
});

// ── Pagination Générique ─────────────────────────────────────
function buildPag(containerId, data, cb) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (data.pages <= 1) return;
  
  const prev = document.createElement('button');
  prev.className='btn btn-secondary btn-sm'; prev.textContent='← Préc.';
  prev.disabled=data.page<=1; prev.onclick=()=>cb(data.page-1); el.appendChild(prev);
  
  const info = document.createElement('span');
  info.className='info'; info.textContent=`${data.page} / ${data.pages}`; el.appendChild(info);
  
  const next = document.createElement('button');
  next.className='btn btn-secondary btn-sm'; next.textContent='Suiv. →';
  next.disabled=data.page>=data.pages; next.onclick=()=>cb(data.page+1); el.appendChild(next);
}

// ── Profil : Modifier son nom ────────────────────────────────
document.getElementById('form-profil')?.addEventListener('submit', async e => {
  e.preventDefault();
  hideErr('p-err');
  const okEl = document.getElementById('p-ok');
  okEl?.classList.add('hidden');

  const nom = document.getElementById('p-nom').value.trim();
  try {
    const data = await api('/api/users/profil', {
      method: 'PUT',
      body: JSON.stringify({ nom })
    });
    ME.nom = data.user.nom;
    document.getElementById('hdr-user').textContent = `${ME.nom} · ${ROLE_LABEL[ME.role]||ME.role}`;
    if(okEl) {
        okEl.textContent = '✅ Nom mis à jour !';
        okEl.classList.remove('hidden');
    }
    setTimeout(() => closeModal('modal-profil'), 1500);
  } catch (err) { showErr('p-err', err.message); }
});

function openProfilModal() {
  document.getElementById('p-nom').value = ME ? ME.nom : '';
  hideErr('p-err');
  document.getElementById('p-ok')?.classList.add('hidden');
  openModal('modal-profil');
}

// ── Déconnexion ──────────────────────────────────────────────
async function logout() {
  await fetch('/api/auth/logout', { method:'POST' });
  window.location.href = 'login.html';
}

// ── Démarrage & Routage par Rôle ─────────────────────────────
async function init() {
  try { 
    ME = await api('/api/auth/me'); 
    document.getElementById('hdr-user').textContent = `${ME.nom} · ${ROLE_LABEL[ME.role]||ME.role}`;

    // On appelle la fonction spécifique définie dans student.js, teacher.js ou admin.js
    if      (ME.role === 'student' && typeof initStudent === 'function') initStudent();
    else if (ME.role === 'teacher' && typeof initTeacher === 'function') initTeacher();
    else if (ME.role === 'admin'   && typeof initAdmin   === 'function') initAdmin();
  }
  catch (e) { 
    console.error('Init failed:', e.message);
    window.location.href = 'login.html'; 
  }
}

// Lancement automatique
init();