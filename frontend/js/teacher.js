// ============================================================
//  js/teacher.js — Logique spécifique à l'enseignant
// ============================================================
'use strict';

let activeGroupId = null;

/**
 * Point d'entrée pour la vue enseignant
 */
function initTeacher() {
  const view = document.getElementById('view-teacher');
  if (!view) return;

  view.classList.remove('hidden');
  setupFormGroup();
  loadGroups();
}

/**
 * Charge les groupes créés par le professeur
 */
async function loadGroups() {
  const list = document.getElementById('groups-list');
  try {
    const groups = await api('/api/groups/my-groups');
    if (!groups.length) {
      list.innerHTML = '<p class="muted" style="margin-bottom:1rem">Aucun groupe créé.</p>'; 
      return;
    }
    list.innerHTML = groups.map(g => `
      <div class="gcard">
        <div class="gcard-info">
          <h3>${esc(g.name)}</h3>
          <small>${g.nb_students} élève(s) · ${g.nb_tasks} tâche(s) · créé le ${fmtDate(g.created_at)}</small>
        </div>
        <div class="gcard-actions">
          <button onclick="openDetail(${g.id},'${esc(g.name)}')"
            class="btn btn-secondary btn-sm">Voir tâches</button>
          <button onclick="deleteGroup(${g.id})" class="btn btn-danger">Suppr.</button>
        </div>
      </div>`).join('');
  } catch(e) { 
    list.innerHTML = `<p class="err">${esc(e.message)}</p>`; 
  }
}

/**
 * Création d'un nouveau groupe
 */
function setupFormGroup() {
  document.getElementById('form-group')?.addEventListener('submit', async e => {
    e.preventDefault(); 
    hideErr('g-err');
    try {
      const d = await api('/api/groups', {
        method:'POST', 
        body: JSON.stringify({ name: document.getElementById('g-name').value })
      });
      document.getElementById('g-name').value = '';
      toast(d.message); 
      loadGroups();
    } catch(err) { 
      showErr('g-err', err.message); 
    }
  });
}

/**
 * Supprime un groupe (et ses tâches par cascade en base)
 */
async function deleteGroup(id) {
  if (!confirm('Supprimer ce groupe et toutes ses tâches ?')) return;
  try { 
    const d = await api(`/api/groups/${id}`, { method:'DELETE' }); 
    toast(d.message); 
    closeDetail(); 
    loadGroups(); 
  } catch(e) { 
    toast(e.message, true); 
  }
}

/**
 * Affiche le panneau de détails d'un groupe
 */
function openDetail(id, name) {
  activeGroupId = id;
  document.getElementById('detail-name').textContent = 'Tâches — ' + name;
  document.getElementById('group-detail').classList.remove('hidden');
  loadGroupTasks(id, 1);
}

function closeDetail() {
  document.getElementById('group-detail')?.classList.add('hidden'); 
  activeGroupId = null;
}

/**
 * Charge les tâches des élèves d'un groupe spécifique
 */
async function loadGroupTasks(id, page) {
  const tbody = document.getElementById('group-tasks-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:1rem">Chargement…</td></tr>';
  try {
    const data = await api(`/api/groups/${id}/tasks?page=${page}`);
    if (!data.tasks.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:1.2rem">Aucune tâche dans ce groupe.</td></tr>';
    } else {
      tbody.innerHTML = data.tasks.map(t => `
        <tr>
          <td>${esc(t.student_nom)}</td>
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
          <td style="text-align:right">
            <button onclick="openFeedbackModal(${t.id},'${esc(t.title)}','${esc(t.student_nom)}','${t.feedback||''}','${esc(t.feedback_comment||'')}')"
              class="btn btn-secondary btn-sm">💬 Avis</button>
          </td>
        </tr>`).join('');
    }
    buildPag('pag-teacher', data, p => loadGroupTasks(id, p));
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="err" style="padding:1rem">${esc(e.message)}</td></tr>`;
  }
}

// ── Gestion du Feedback ──────────────────────────────────────

function openFeedbackModal(taskId, title, studentName, currentFb, currentComment) {
  document.getElementById('fb-task-id').value = taskId;
  document.getElementById('fb-task-title').textContent = title;
  document.getElementById('fb-student-name').textContent = studentName;
  document.getElementById('fb-comment').value = currentComment;
  document.getElementById('fb-value').value = currentFb;
  
  hideErr('fb-err');
  document.querySelectorAll('.fb-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.v === currentFb);
  });
  openModal('modal-feedback');
}

document.querySelectorAll('.fb-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fb-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('fb-value').value = btn.dataset.v;
  });
});

document.getElementById('form-feedback')?.addEventListener('submit', async e => {
  e.preventDefault(); 
  hideErr('fb-err');
  const id = document.getElementById('fb-task-id').value;
  const feedback = document.getElementById('fb-value').value;
  const comment = document.getElementById('fb-comment').value;

  if (!feedback) { showErr('fb-err', 'Veuillez sélectionner un avis.'); return; }

  try {
    const d = await api(`/api/tasks/${id}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback, feedback_comment: comment })
    });
    closeModal('modal-feedback'); 
    toast(d.message);
    if (activeGroupId) loadGroupTasks(activeGroupId, 1);
  } catch(err) { 
    showErr('fb-err', err.message); 
  }
});

// ── Gestion de l'Assignation (Modaux) ─────────────────────────

async function openAssignModal() {
  hideErr('a-err'); 
  hideErr('r-err');
  const stuSel = document.getElementById('a-student');
  const grpSel = document.getElementById('a-group');
  const rGrp   = document.getElementById('r-group');

  stuSel.innerHTML = '<option value="">Chargement…</option>';
  grpSel.innerHTML = '<option value="">Chargement…</option>';

  try {
    const [unassigned, myGroups] = await Promise.all([
      api('/api/groups/unassigned-students'),
      api('/api/groups/my-groups')
    ]);

    stuSel.innerHTML = '<option value="">— Sélectionner un élève —</option>';
    unassigned.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = `${s.nom} (${s.email})`;
      stuSel.appendChild(o);
    });

    grpSel.innerHTML = '<option value="">— Sélectionner un groupe —</option>';
    rGrp.innerHTML   = '<option value="">— Sélectionner un groupe —</option>';
    myGroups.forEach(g => {
      const o1 = document.createElement('option'); o1.value = g.id; o1.textContent = g.name; grpSel.appendChild(o1);
      const o2 = document.createElement('option'); o2.value = g.id; o2.textContent = g.name; rGrp.appendChild(o2);
    });
  } catch(e) { 
    toast(e.message, true); 
  }
  openModal('modal-assign');
}

document.getElementById('r-group')?.addEventListener('change', async function() {
  const rStu = document.getElementById('r-student');
  if (!this.value) { rStu.innerHTML = '<option value="">— Choisir le groupe d\'abord —</option>'; return; }
  try {
    const students = await api(`/api/groups/${this.value}/students`);
    rStu.innerHTML = '<option value="">— Sélectionner un élève —</option>';
    students.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = `${s.nom} (${s.email})`;
      rStu.appendChild(o);
    });
  } catch(e) { 
    toast(e.message, true); 
  }
});

document.getElementById('form-assign')?.addEventListener('submit', async e => {
  e.preventDefault();
  const studentId = document.getElementById('a-student').value;
  const groupId = document.getElementById('a-group').value;
  try {
    const d = await api(`/api/users/${studentId}/group`, {
      method:'PATCH', body: JSON.stringify({ groupId: parseInt(groupId, 10) })
    });
    toast(d.message); 
    loadGroups();
    closeModal('modal-assign');
  } catch(err) { 
    showErr('a-err', err.message); 
  }
});

document.getElementById('form-remove')?.addEventListener('submit', async e => {
  e.preventDefault();
  const studentId = document.getElementById('r-student').value;
  if (!confirm('Retirer cet élève ?')) return;
  try {
    const d = await api(`/api/users/${studentId}/group`, {
      method:'PATCH', body: JSON.stringify({ groupId: null })
    });
    toast(d.message); 
    loadGroups();
    closeModal('modal-assign');
  } catch(err) { 
    showErr('r-err', err.message); 
  }
});