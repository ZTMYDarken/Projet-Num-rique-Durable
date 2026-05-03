// ============================================================
//  js/admin.js — Logique spécifique à l'administrateur
// ============================================================
'use strict';

/**
 * Point d'entrée pour la vue administrateur
 */
function initAdmin() {
  const view = document.getElementById('view-admin');
  if (!view) return;

  view.classList.remove('hidden');
  loadUsers(1); // Charge la première page des utilisateurs
}

/**
 * Charge la liste de tous les utilisateurs (paginée)
 */
async function loadUsers(page) {
  const tbody = document.getElementById('users-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:1rem">Chargement…</td></tr>';
  
  try {
    const data = await api(`/api/users?page=${page}`);
    
    if (!data.users || data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:1.2rem">Aucun utilisateur trouvé.</td></tr>';
      return;
    }

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td>${esc(u.nom)}</td>
        <td>${esc(u.email)}</td>
        <td>${roleBadge(u.role)}</td>
        <td>${u.group_id ? '#' + u.group_id : '<span class="muted">—</span>'}</td>
        <td style="white-space:nowrap">${fmtDate(u.created_at)}</td>
        <td style="text-align:right">
          ${u.role !== 'admin' 
            ? `<button onclick="deleteUser(${u.id}, '${esc(u.nom)}')" class="btn btn-danger btn-sm">Supprimer</button>` 
            : '<small class="muted">Action interdite</small>'}
        </td>
      </tr>`).join('');

    // Construit la barre de navigation entre les pages
    buildPag('pag-admin', data, loadUsers);

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="err" style="padding:1rem">${esc(e.message)}</td></tr>`;
  }
}

/**
 * Supprime un utilisateur après confirmation
 * @param {number} id - L'ID de l'utilisateur
 * @param {string} nom - Le nom pour la confirmation
 */
async function deleteUser(id, nom) {
  if (!confirm(`Voulez-vous vraiment supprimer l'utilisateur "${nom}" ?\nCette action est irréversible.`)) {
    return;
  }

  try {
    const d = await api(`/api/users/${id}`, { method: 'DELETE' });
    toast(d.message);
    loadUsers(1); // Recharge la liste pour mettre à jour l'affichage
  } catch (e) {
    toast(e.message, true);
  }
}
