// ============================================================
//  js/student.js — Logique spécifique à l'élève
// ============================================================
'use strict';

let activeFilter = '';

/**
 * Point d'entrée pour la vue élève
 */
function initStudent() {
  const view = document.getElementById('view-student');
  if (!view) return;
  
  view.classList.remove('hidden');

  // Vérification du groupe
  if (!ME.group_id) {
    document.getElementById('no-group-alert')?.classList.remove('hidden');
    return;
  }

  // Si l'élève a un groupe, on affiche le formulaire et les tâches
  document.getElementById('task-form-wrap')?.classList.remove('hidden');
  
  setupStudentFilters();
  setupFormTask();
  loadTasks(1);
}

/**
 * Gestion des boutons de filtres (À faire, En cours, etc.)
 */
function setupStudentFilters() {
  document.querySelectorAll('.btn-f').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-f').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.s || '';
      loadTasks(1);
    });
  });
}

/**
 * Chargement de la liste des tâches (paginée)
 */
async function loadTasks(page) {
  const tbody = document.getElementById('tasks-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:1rem">Chargement…</td></tr>';
  
  const url = `/api/tasks/my-tasks?page=${page}${activeFilter ? '&status='+activeFilter : ''}`;
  
  try {
    const data = await api(url);
    
    if (!data.tasks || data.tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:1.2rem">Aucune tâche trouvée.</td></tr>';
    } else {
      tbody.innerHTML = data.tasks.map(t => `
        <tr>
          <td>
            <strong>${esc(t.title)}</strong>
            ${t.description ? `<br><small class="muted">${esc(t.description)}</small>` : ''}
          </td>
          <td>${statusBadge(t.status)}</td>
          <td style="white-space:nowrap">${fmtDate(t.due_date)}</td>
          <td>
            ${feedbackBadge(t.feedback)}
            ${t.feedback_comment
              ? `<br><small class="muted" style="font-size:.78rem">${esc(t.feedback_comment)}</small>`
              : ''}
          </td>
          <td style="white-space:nowrap;text-align:right">
            <button onclick="openEditTask(${t.id},'${esc(t.title)}','${esc(t.description)}','${t.status}','${t.due_date||''}')"
              class="btn btn-secondary btn-sm">Modifier</button>
            <button onclick="deleteTask(${t.id})"
              class="btn btn-danger" style="margin-left:.3rem">Suppr.</button>
          </td>
        </tr>`).join('');
    }
    buildPag('pag-student', data, loadTasks);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" class="err" style="padding:1rem">${esc(e.message)}</td></tr>`;
  }
}

/**
 * Création d'une nouvelle tâche
 */
function setupFormTask() {
  const form = document.getElementById('form-task');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault(); 
    hideErr('t-err');
    
    const msgEl = document.getElementById('task-form-msg');
    msgEl?.classList.add('hidden');

    try {
      const data = await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title:       document.getElementById('t-title').value,
          description: document.getElementById('t-desc').value,
          status:      document.getElementById('t-status').value,
          due_date:    document.getElementById('t-due').value || null
        })
      });

      form.reset();
      if (msgEl) {
        msgEl.textContent = data.message || '✅ Tâche ajoutée !';
        msgEl.style.background = 'var(--ok)'; 
        msgEl.style.color = '#fff';
        msgEl.classList.remove('hidden');
        setTimeout(() => msgEl.classList.add('hidden'), 2500);
      }
      loadTasks(1);
    } catch(err) { 
      showErr('t-err', err.message); 
    }
  });
}

/**
 * Suppression d'une tâche
 */
async function deleteTask(id) {
  if (!confirm('Voulez-vous vraiment supprimer cette tâche ?')) return;
  try { 
    const d = await api(`/api/tasks/${id}`, { method:'DELETE' }); 
    toast(d.message); 
    loadTasks(1); 
  } catch(e) { 
    toast(e.message, true); 
  }
}

/**
 * Ouverture de la modal de modification
 */
function openEditTask(id, title, desc, status, due) {
  document.getElementById('e-id').value     = id;
  document.getElementById('e-title').value  = title;
  document.getElementById('e-desc').value   = desc;
  document.getElementById('e-status').value = status;
  // Formatage de la date pour l'input type="date" (YYYY-MM-DD)
  document.getElementById('e-due').value    = due ? due.split('T')[0] : '';
  
  hideErr('e-err'); 
  openModal('modal-edit');
}

/**
 * Enregistrement des modifications
 */
document.getElementById('form-edit')?.addEventListener('submit', async e => {
  e.preventDefault(); 
  hideErr('e-err');
  
  const id = document.getElementById('e-id').value;
  try {
    const d = await api(`/api/tasks/${id}`, {
      method:'PUT',
      body: JSON.stringify({
        title:       document.getElementById('e-title').value,
        description: document.getElementById('e-desc').value,
        status:      document.getElementById('e-status').value,
        due_date:    document.getElementById('e-due').value || null
      })
    });
    closeModal('modal-edit'); 
    toast(d.message); 
    loadTasks(1);
  } catch(err) { 
    showErr('e-err', err.message); 
  }
});