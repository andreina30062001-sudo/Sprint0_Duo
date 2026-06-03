// ============================================================
// app.js — Lógica del Frontend (Fetch API)
// Sistemas de Información 2 — Extreme Programming
// ============================================================

const API = '/api/historias';

// ── DOM Elements ─────────────────────────────────────────────
const listaHistorias   = document.getElementById('listaHistorias');
const sidebarTeam      = document.getElementById('sidebarTeam');
const inputTitulo      = document.getElementById('inputTitulo');
const inputDescripcion = document.getElementById('inputDescripcion');
const btnGuardarHU     = document.getElementById('btnGuardarHU');
const btnGuardarPareja = document.getElementById('btnGuardarPareja');
const pairHuId         = document.getElementById('pairHuId');
const pairHuTitle      = document.getElementById('pairHuTitle');
const pairPiloto       = document.getElementById('pairPiloto');
const pairCopiloto     = document.getElementById('pairCopiloto');
const statTotal        = document.getElementById('statTotal');
const statAsignadas    = document.getElementById('statAsignadas');
const statPendientes   = document.getElementById('statPendientes');
const toastEl          = document.getElementById('toast');
const toastMsg         = document.getElementById('toastMsg');

let modalNuevaHU, modalPareja;
let currentPairId = null; // ID de la historia abierta en el modal de pareja

// ── Color palette for avatars ────────────────────────────────
const avatarColors = [
  '#6c63ff', '#2dd4a8', '#f5a623', '#ef4565',
  '#3b82f6', '#a855f7', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16', '#06b6d4', '#e11d48'
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  modalNuevaHU = new bootstrap.Modal(document.getElementById('modalNuevaHU'));
  modalPareja  = new bootstrap.Modal(document.getElementById('modalPareja'));

  cargarHistorias();

  btnGuardarHU.addEventListener('click', crearHistoria);
  btnGuardarPareja.addEventListener('click', guardarPareja);

  inputTitulo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); crearHistoria(); }
  });
});

// ── Toast ────────────────────────────────────────────────────
function mostrarToast(msg, isError = false) {
  toastMsg.textContent = msg;
  toastEl.classList.toggle('error', isError);
  toastEl.querySelector('i').className = isError
    ? 'bi bi-exclamation-triangle-fill'
    : 'bi bi-check-circle-fill';
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2800);
}

// ── Stats ────────────────────────────────────────────────────
function actualizarStats(historias) {
  const total = historias.length;
  const asignadas = historias.filter(h => h.piloto || h.copiloto).length;
  statTotal.textContent = total;
  statAsignadas.textContent = asignadas;
  statPendientes.textContent = total - asignadas;
}

// ══════════════════════════════════════════════════════════════
// LOAD & RENDER
// ══════════════════════════════════════════════════════════════
async function cargarHistorias() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('Error del servidor');
    const historias = await res.json();

    actualizarStats(historias);
    renderHistorias(historias);
    renderSidebar(historias);
  } catch (err) {
    console.error(err);
    mostrarToast('Error al cargar historias', true);
  }
}

// ── Render story rows ────────────────────────────────────────
function renderHistorias(historias) {
  if (historias.length === 0) {
    listaHistorias.innerHTML = `
      <div class="empty-state anim-row">
        <i class="bi bi-journal-code"></i>
        <h5>Sin historias aún</h5>
        <p>Presiona <strong>"+ Agregar HU"</strong> para registrar tu primera Historia de Usuario.</p>
      </div>`;
    return;
  }

  listaHistorias.innerHTML = historias.map((h, i) => {
    const hasPair = h.piloto || h.copiloto;
    const delay = i * 0.05;

    let chipsHTML = '';
    if (hasPair) {
      if (h.piloto) chipsHTML += `<span class="role-chip pilot"><i class="bi bi-airplane-fill"></i> ${esc(h.piloto)}</span>`;
      if (h.copiloto) chipsHTML += `<span class="role-chip copilot"><i class="bi bi-person-badge-fill"></i> ${esc(h.copiloto)}</span>`;
    } else {
      chipsHTML = `<span class="role-chip unassigned"><i class="bi bi-clock"></i> Sin asignar</span>`;
    }

    return `
      <div class="story-row anim-row" style="animation-delay:${delay}s" id="row-${h.id}">
        <div class="story-id-badge">HU-${String(h.id).padStart(3, '0')}</div>
        <div class="story-content">
          <h6>${esc(h.titulo)}</h6>
          <p>${esc(h.descripcion || 'Sin descripción')}</p>
        </div>
        <div class="role-chips">${chipsHTML}</div>
        <div class="story-actions">
          <button class="btn-pair" onclick="abrirModalPareja(${h.id}, '${escAttr(h.titulo)}', '${escAttr(h.piloto || '')}', '${escAttr(h.copiloto || '')}')" title="Asignar pareja">
            <i class="bi bi-people-fill"></i> Pareja
          </button>
          <button class="btn-del" onclick="eliminarHistoria(${h.id})" title="Eliminar">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}

// ── Render sidebar: team summary ─────────────────────────────
function renderSidebar(historias) {
  // Build a map: person → [{ role, historia }]
  const teamMap = new Map();

  historias.forEach(h => {
    if (h.piloto) {
      const name = h.piloto.trim();
      if (!teamMap.has(name)) teamMap.set(name, []);
      teamMap.get(name).push({ role: 'Piloto', hu: h });
    }
    if (h.copiloto) {
      const name = h.copiloto.trim();
      if (!teamMap.has(name)) teamMap.set(name, []);
      teamMap.get(name).push({ role: 'Copiloto', hu: h });
    }
  });

  if (teamMap.size === 0) {
    sidebarTeam.innerHTML = `
      <div class="sidebar-empty">
        <i class="bi bi-person-plus"></i>
        <p>Asigna parejas en las historias para ver el equipo aquí.</p>
      </div>`;
    return;
  }

  let html = '';
  teamMap.forEach((tasks, name) => {
    const color = getAvatarColor(name);
    const initials = getInitials(name);

    html += `
      <div class="team-member">
        <div class="member-header">
          <div class="member-avatar" style="background:${color}">${initials}</div>
          <div class="member-name">${esc(name)}</div>
          <div class="member-count">${tasks.length}</div>
        </div>
        <div class="member-tasks">
          ${tasks.map(t => `
            <div class="member-task">
              <span class="task-role ${t.role === 'Piloto' ? 'is-pilot' : 'is-copilot'}">${t.role}</span>
              <span class="task-name">${esc(t.hu.titulo)}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  });

  sidebarTeam.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
// CREATE STORY (POST)
// ══════════════════════════════════════════════════════════════
async function crearHistoria() {
  const titulo = inputTitulo.value.trim();
  const descripcion = inputDescripcion.value.trim();

  if (!titulo) {
    inputTitulo.focus();
    mostrarToast('El título es obligatorio', true);
    return;
  }

  btnGuardarHU.disabled = true;
  btnGuardarHU.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando…';

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, descripcion })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error al crear');
    }

    document.getElementById('formNuevaHU').reset();
    modalNuevaHU.hide();
    mostrarToast('Historia de Usuario creada');
    await cargarHistorias();
  } catch (err) {
    console.error(err);
    mostrarToast(err.message, true);
  } finally {
    btnGuardarHU.disabled = false;
    btnGuardarHU.innerHTML = '<i class="bi bi-check-lg me-1"></i> Guardar';
  }
}

// ══════════════════════════════════════════════════════════════
// PAIR ASSIGNMENT MODAL
// ══════════════════════════════════════════════════════════════
function abrirModalPareja(id, titulo, piloto, copiloto) {
  currentPairId = id;
  pairHuId.textContent = `HU-${String(id).padStart(3, '0')}`;
  pairHuTitle.textContent = titulo;
  pairPiloto.value = piloto;
  pairCopiloto.value = copiloto;
  modalPareja.show();

  // Focus on first empty field
  setTimeout(() => {
    if (!piloto) pairPiloto.focus();
    else if (!copiloto) pairCopiloto.focus();
    else pairPiloto.focus();
  }, 300);
}

async function guardarPareja() {
  if (!currentPairId) return;

  const piloto = pairPiloto.value.trim();
  const copiloto = pairCopiloto.value.trim();

  btnGuardarPareja.disabled = true;
  btnGuardarPareja.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando…';

  try {
    const res = await fetch(`${API}/${currentPairId}/pareja`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ piloto, copiloto })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error al asignar');
    }

    modalPareja.hide();
    mostrarToast('Roles asignados correctamente');
    await cargarHistorias();
  } catch (err) {
    console.error(err);
    mostrarToast(err.message, true);
  } finally {
    btnGuardarPareja.disabled = false;
    btnGuardarPareja.innerHTML = '<i class="bi bi-check2-all me-1"></i> Guardar Pareja';
    currentPairId = null;
  }
}

// ══════════════════════════════════════════════════════════════
// DELETE STORY
// ══════════════════════════════════════════════════════════════
async function eliminarHistoria(id) {
  if (!confirm('¿Eliminar esta Historia de Usuario?')) return;

  try {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar');

    mostrarToast('Historia eliminada');
    await cargarHistorias();
  } catch (err) {
    console.error(err);
    mostrarToast(err.message, true);
  }
}

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escAttr(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
