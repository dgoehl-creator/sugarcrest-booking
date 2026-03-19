/**
 * SugarCrest — Admin Dashboard JS
 * Handles auth gate, all data loading, family allocations, blocked dates.
 */

'use strict';

const ADMIN_PW_KEY = 'sc_admin_pw';
let   adminPw      = '';

/* ════════════════════════════════════════════════
   AUTH GATE
   ════════════════════════════════════════════════ */
(function initAuth() {
  const gate     = document.getElementById('password-gate');
  const shell    = document.getElementById('admin-shell');
  const pwInput  = document.getElementById('pw-input');
  const pwSubmit = document.getElementById('pw-submit');
  const pwError  = document.getElementById('pw-error');

  // Check stored session
  const stored = sessionStorage.getItem(ADMIN_PW_KEY);
  if (stored) {
    adminPw = stored;
    unlockAdmin();
    return;
  }

  pwSubmit.addEventListener('click', attemptLogin);
  pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });

  async function attemptLogin() {
    const pw = pwInput.value.trim();
    if (!pw) return;
    pwSubmit.disabled = true;
    pwSubmit.textContent = 'Checking…';

    // Verify by hitting a protected endpoint
    try {
      const res = await fetch('/.netlify/functions/get-bookings?type=public', {
        headers: { 'x-admin-password': pw }
      });
      if (res.ok) {
        adminPw = pw;
        sessionStorage.setItem(ADMIN_PW_KEY, pw);
        unlockAdmin();
      } else {
        pwError.textContent = 'Incorrect password.';
        pwSubmit.disabled = false;
        pwSubmit.textContent = 'Sign In →';
      }
    } catch {
      pwError.textContent = 'Connection error. Make sure the site is live on Netlify.';
      pwSubmit.disabled = false;
      pwSubmit.textContent = 'Sign In →';
    }
  }

  function unlockAdmin() {
    gate.style.display  = 'none';
    shell.style.display = 'flex';
    initAdminApp();
  }

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_PW_KEY);
    location.reload();
  });
})();


/* ════════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════════ */
function initAdminApp() {
  document.querySelectorAll('.admin-nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      const section = document.getElementById(`section-${item.dataset.section}`);
      if (section) section.classList.add('active');
      loadSection(item.dataset.section);
    });
  });

  // Load dashboard by default
  loadSection('dashboard');

  // Refresh buttons
  document.getElementById('refresh-public')?.addEventListener('click', () => loadSection('public-bookings'));
  document.getElementById('refresh-family')?.addEventListener('click', () => loadSection('family-bookings'));
  document.getElementById('refresh-allocations')?.addEventListener('click', () => loadSection('family-allocations'));
  document.getElementById('refresh-blocks')?.addEventListener('click', () => loadSection('blocked-dates'));

  // Add allocation
  document.getElementById('add-alloc-btn')?.addEventListener('click', addFamilyAllocation);
  // Add block
  document.getElementById('add-block-btn')?.addEventListener('click', addBlockedDates);
}

function loadSection(section) {
  switch (section) {
    case 'dashboard':          loadDashboard();       break;
    case 'public-bookings':    loadPublicBookings();  break;
    case 'family-bookings':    loadFamilyBookings();  break;
    case 'family-allocations': loadAllocations();     break;
    case 'blocked-dates':      loadBlockedDates();    break;
  }
}


/* ════════════════════════════════════════════════
   API HELPERS
   ════════════════════════════════════════════════ */
async function adminFetch(url) {
  const res = await fetch(url, { headers: { 'x-admin-password': adminPw } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function adminPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPw },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}


/* ════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const data = await adminFetch('/.netlify/functions/get-bookings?type=all');
    const bookings       = data.bookings       || [];
    const familyBookings = data.familyBookings || [];
    const today = new Date(); today.setHours(0,0,0,0);

    const upcoming = bookings.filter(b => b.checkIn && parseDate(b.checkIn) >= today);
    const ytdRevenue = bookings
      .filter(b => {
        if (!b.createdAt) return false;
        return new Date(b.createdAt).getFullYear() === today.getFullYear();
      })
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const returning = bookings.filter(b => b.returningGuest).length;

    document.getElementById('stat-total').textContent    = bookings.length;
    document.getElementById('stat-upcoming').textContent = upcoming.length;
    document.getElementById('stat-revenue').textContent  = formatCurrency(ytdRevenue);
    document.getElementById('stat-family').textContent   = familyBookings.length;
    document.getElementById('stat-returning').textContent= returning;

    // Upcoming table (next 5)
    const upcomingSorted = upcoming
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .slice(0, 5);

    const tbody = document.getElementById('upcoming-tbody');
    if (upcomingSorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px;">No upcoming bookings</td></tr>`;
    } else {
      tbody.innerHTML = upcomingSorted.map(b => `
        <tr>
          <td><strong>${escHtml(b.guest || '—')}</strong></td>
          <td>${b.checkIn || '—'}</td>
          <td>${b.checkOut || '—'}</td>
          <td>${nightsBetween(b.checkIn, b.checkOut)}</td>
          <td>—</td>
          <td><span class="badge badge-teal">Public</span></td>
          <td class="amount">${b.amount ? formatCurrency(b.amount) : '—'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Failed to load dashboard data. Make sure site is live on Netlify.', 'error');
  }
}


/* ════════════════════════════════════════════════
   PUBLIC BOOKINGS
   ════════════════════════════════════════════════ */
async function loadPublicBookings() {
  const tbody = document.getElementById('public-tbody');
  tbody.innerHTML = loadingRow(10);
  try {
    const data     = await adminFetch('/.netlify/functions/get-bookings?type=public');
    const bookings = data.bookings || [];
    if (!bookings.length) {
      tbody.innerHTML = emptyRow(10, 'No public bookings yet.');
      return;
    }
    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td><code style="font-size:.8rem;">${escHtml(b.conf || '—')}</code></td>
        <td>
          <strong>${escHtml(b.guest || '—')}</strong>
          ${b.returningGuest ? '<br><span class="badge badge-amber" style="font-size:.65rem;">⭐ Returning</span>' : ''}
        </td>
        <td>
          <a href="mailto:${escHtml(b.email || '')}" style="font-size:.82rem;">${escHtml(b.email || '—')}</a>
        </td>
        <td>${b.checkIn || '—'}</td>
        <td>${b.checkOut || '—'}</td>
        <td>${nightsBetween(b.checkIn, b.checkOut)}</td>
        <td>—</td>
        <td class="amount">${b.amount ? formatCurrency(b.amount) : '—'}</td>
        <td>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.82rem;">
            <input type="checkbox" ${b.returningGuest ? 'checked' : ''}
              onchange="toggleReturningGuest('${escHtml(b.conf)}', this.checked)"
              style="accent-color:var(--amber);">
            Returning
          </label>
        </td>
        <td style="font-size:.78rem;color:#aaa;">${b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = errorRow(10, err.message);
  }
}

async function toggleReturningGuest(confNumber, value) {
  try {
    await adminPost('/.netlify/functions/admin-actions', {
      action: 'mark-returning-guest', confNumber, value
    });
    showToast(`Updated returning guest status for ${confNumber}`, 'success');
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}


/* ════════════════════════════════════════════════
   FAMILY BOOKINGS
   ════════════════════════════════════════════════ */
async function loadFamilyBookings() {
  const tbody = document.getElementById('family-tbody');
  tbody.innerHTML = loadingRow(10);
  try {
    const data     = await adminFetch('/.netlify/functions/get-bookings?type=family');
    const bookings = data.familyBookings || [];
    if (!bookings.length) {
      tbody.innerHTML = emptyRow(10, 'No F&F bookings yet.');
      return;
    }
    tbody.innerHTML = bookings.map(b => `
      <tr class="family-row">
        <td><code style="font-size:.8rem;">${escHtml(b.conf || '—')}</code></td>
        <td><strong>${escHtml(b.guest || '—')}</strong></td>
        <td>
          <a href="mailto:${escHtml(b.email || '')}" style="font-size:.82rem;">${escHtml(b.email || '—')}</a>
        </td>
        <td>${b.checkIn || '—'}</td>
        <td>${b.checkOut || '—'}</td>
        <td>${nightsBetween(b.checkIn, b.checkOut)}</td>
        <td>—</td>
        <td class="amount" style="color:#6b33c4;">${b.amount ? formatCurrency(b.amount) : '—'}</td>
        <td style="font-size:.82rem;max-width:160px;color:#888;">${escHtml(b.message || '—')}</td>
        <td style="font-size:.78rem;color:#aaa;">${b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = errorRow(10, err.message);
  }
}


/* ════════════════════════════════════════════════
   FAMILY ALLOCATIONS
   ════════════════════════════════════════════════ */
async function loadAllocations() {
  const tbody = document.getElementById('allocations-tbody');
  tbody.innerHTML = loadingRow(7);
  try {
    const data        = await adminFetch('/.netlify/functions/get-bookings?type=family-allocations-admin');
    const allocations = data.allocations || [];
    if (!allocations.length) {
      tbody.innerHTML = emptyRow(7, 'No family allocations yet. Add one above.');
      return;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    tbody.innerHTML = allocations.map(a => {
      const isPast = a.endDate && parseDate(a.endDate) < today;
      return `
        <tr>
          <td>${a.startDate || '—'}</td>
          <td>${a.endDate   || '—'}</td>
          <td>${nightsBetween(a.startDate, a.endDate)}</td>
          <td style="font-size:.85rem;color:#888;">${escHtml(a.note || '—')}</td>
          <td style="font-size:.78rem;color:#aaa;">${a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}</td>
          <td>
            ${isPast
              ? '<span class="badge" style="background:#f0f0f0;color:#aaa;">Past</span>'
              : '<span class="badge badge-green">Available</span>'
            }
          </td>
          <td>
            <button class="btn btn-sm" style="background:#fde8e8;color:#c0392b;border:none;"
              onclick="deleteAllocation('${escHtml(a.id)}')">Remove</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = errorRow(7, err.message);
  }
}

async function addFamilyAllocation() {
  const startDate = document.getElementById('alloc-start')?.value;
  const endDate   = document.getElementById('alloc-end')?.value;
  const note      = document.getElementById('alloc-note')?.value?.trim();

  if (!startDate || !endDate) {
    showToast('Please select both start and end dates.', 'error'); return;
  }
  if (parseDate(endDate) <= parseDate(startDate)) {
    showToast('End date must be after start date.', 'error'); return;
  }

  const btn = document.getElementById('add-alloc-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    await adminPost('/.netlify/functions/admin-actions', {
      action: 'add-family-allocation', startDate, endDate, note
    });
    showToast('Family window added successfully!', 'success');
    document.getElementById('alloc-start').value = '';
    document.getElementById('alloc-end').value   = '';
    document.getElementById('alloc-note').value  = '';
    loadAllocations();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Add Family Window →';
  }
}

async function deleteAllocation(id) {
  if (!confirm('Remove this family allocation? It will no longer appear on the family booking page.')) return;
  try {
    await adminPost('/.netlify/functions/admin-actions', { action: 'delete-family-allocation', id });
    showToast('Allocation removed.', 'success');
    loadAllocations();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}


/* ════════════════════════════════════════════════
   BLOCKED DATES
   ════════════════════════════════════════════════ */
async function loadBlockedDates() {
  const tbody = document.getElementById('blocks-tbody');
  tbody.innerHTML = loadingRow(6);
  try {
    const data    = await adminFetch('/.netlify/functions/get-bookings?type=blocked-dates');
    const blocked = data.blockedDates || [];
    if (!blocked.length) {
      tbody.innerHTML = emptyRow(6, 'No blocked dates. Add a block above.');
      return;
    }
    tbody.innerHTML = blocked.map(b => `
      <tr>
        <td>${b.startDate || b.date || '—'}</td>
        <td>${b.endDate   || b.date || '—'}</td>
        <td>${nightsBetween(b.startDate || b.date, b.endDate || b.date)}</td>
        <td style="font-size:.85rem;">${escHtml(b.label || 'Owner block')}</td>
        <td style="font-size:.78rem;color:#aaa;">${b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}</td>
        <td>
          <button class="btn btn-sm" style="background:#fde8e8;color:#c0392b;border:none;"
            onclick="removeBlock('${escHtml(b.id)}')">Remove</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = errorRow(6, err.message);
  }
}

async function addBlockedDates() {
  const startDate = document.getElementById('block-start')?.value;
  const endDate   = document.getElementById('block-end')?.value;
  const label     = document.getElementById('block-label')?.value?.trim();

  if (!startDate) {
    showToast('Please select a start date.', 'error'); return;
  }

  const btn = document.getElementById('add-block-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    await adminPost('/.netlify/functions/admin-actions', {
      action: 'add-blocked-dates',
      startDate,
      endDate: endDate || startDate,
      label: label || 'Owner block'
    });
    showToast('Dates blocked successfully!', 'success');
    document.getElementById('block-start').value = '';
    document.getElementById('block-end').value   = '';
    document.getElementById('block-label').value = '';
    loadBlockedDates();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Block These Dates →';
  }
}

async function removeBlock(id) {
  if (!confirm('Remove this date block?')) return;
  try {
    await adminPost('/.netlify/functions/admin-actions', { action: 'remove-blocked-date', id });
    showToast('Block removed.', 'success');
    loadBlockedDates();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}


/* ════════════════════════════════════════════════
   TABLE HELPERS
   ════════════════════════════════════════════════ */
function loadingRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;color:#aaa;padding:28px;">
    <div class="spinner" style="border-color:rgba(26,92,107,.15);border-top-color:var(--teal);margin:0 auto 10px;"></div>
    Loading…
  </td></tr>`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;color:#aaa;padding:28px;">${msg}</td></tr>`;
}

function errorRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;color:#c0392b;padding:28px;">
    ⚠️ Error loading data: ${escHtml(msg)}<br>
    <small style="color:#aaa;">Make sure this site is deployed on Netlify with the functions configured.</small>
  </td></tr>`;
}

function nightsBetween(start, end) {
  if (!start || !end) return '—';
  try {
    const n = Math.round((parseDate(end) - parseDate(start)) / 86400000);
    return n > 0 ? n : '—';
  } catch { return '—'; }
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Make admin functions globally accessible for inline onclick handlers
window.deleteAllocation      = deleteAllocation;
window.removeBlock           = removeBlock;
window.toggleReturningGuest  = toggleReturningGuest;
