const COMMON_DOMAINS = [
  'twitter.com','tiktok.com','snapchat.com','twitch.tv','netflix.com',
  'hulu.com','discord.com','pinterest.com','tumblr.com','linkedin.com',
  'amazon.com','ebay.com','etsy.com','9gag.com','buzzfeed.com',
  'imgur.com','quora.com','medium.com','espn.com','bleacherreport.com',
  'news.ycombinator.com','twitch.tv','digg.com','dailymail.co.uk'
];

let blocklist = [];
let currentDifficulty = 'medium';
let charts = {};

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const buf = encoder.encode(password + 'focusguard_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Blocklist helpers ──────────────────────────────────────────────────────────

function renderTags() {
  const container = document.getElementById('tags-container');
  if (!container) return;
  if (blocklist.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--muted)">No sites blocked — add some below</span>';
    return;
  }
  container.innerHTML = blocklist.map(domain => `
    <div class="tag" data-domain="${domain}">
      ${domain}
      <button class="tag-delete" data-domain="${domain}" title="Remove">×</button>
    </div>
  `).join('');
  container.querySelectorAll('.tag-delete').forEach(btn => {
    btn.addEventListener('click', () => removeDomain(btn.dataset.domain));
  });
}

function updateBlocklistCount() {
  const el = document.getElementById('blocklist-count');
  if (el) el.textContent = `${blocklist.length} site${blocklist.length !== 1 ? 's' : ''} blocked`;
}

async function removeDomain(domain) {
  blocklist = blocklist.filter(d => d !== domain);
  await chrome.storage.local.set({ blocklist });
  try { await chrome.runtime.sendMessage({ type: 'UPDATE_RULES' }); } catch(e){}
  renderTags();
  updateBlocklistCount();
}

async function addDomain(domain) {
  domain = domain.toLowerCase().trim()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0];
  if (!domain || blocklist.includes(domain)) return;
  blocklist.push(domain);
  await chrome.storage.local.set({ blocklist });
  try { await chrome.runtime.sendMessage({ type: 'UPDATE_RULES' }); } catch(e){}
  renderTags();
  updateBlocklistCount();
}

// ── Challenge preview ──────────────────────────────────────────────────────────

function updateChallengePreview() {
  const steps = {
    easy:   ['🧮 Solve a math problem', '⏱️ Choose break duration'],
    medium: ['🧮 Solve a math problem', '✍️ Type a commitment phrase exactly', '⏳ Wait 30 seconds', '⏱️ Choose break duration'],
    hard:   ['🔑 Enter master password', '🧮 Solve a math problem', '✍️ Type a commitment phrase exactly', '⏳ Wait 60 seconds', '⏱️ Choose break duration'],
  };
  const preview = document.getElementById('challenge-preview');
  if (!preview) return;
  const s = steps[currentDifficulty] || steps.medium;
  preview.innerHTML = s.map((step, i) => `
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--border)">
      <span style="font-family:'Syne',sans-serif;font-size:0.65rem;font-weight:700;color:var(--accent2);width:18px;flex-shrink:0">${i+1}</span>
      <span style="font-size:0.85rem">${step}</span>
    </div>`).join('');
}

// ── Status sidebar ─────────────────────────────────────────────────────────────

function loadStatus(data) {
  const dot = document.getElementById('sidebar-dot');
  const status = document.getElementById('sidebar-status');
  if (!dot || !status) return;
  if (data.focus_session && data.focus_session.end_time > Date.now()) {
    dot.style.background = 'var(--accent2)';
    status.textContent = '🎯 Focus Session';
  } else if (data.blocking_enabled !== false) {
    dot.style.background = 'var(--accent)';
    status.textContent = 'Blocking Active';
  } else {
    dot.style.background = 'var(--danger)';
    status.textContent = 'Blocking Paused';
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────────

function loadStats(stats) {
  if (!stats) return;
  const el = id => document.getElementById(id);
  if (el('s-total')) el('s-total').textContent = stats.blocked_attempts || 0;
  if (el('s-fails')) el('s-fails').textContent = stats.challenge_failures || 0;
  const today = new Date().toISOString().split('T')[0];
  if (el('s-today')) el('s-today').textContent = (stats.daily_attempts || {})[today] || 0;
}

function loadCharts() {
  chrome.storage.local.get('stats', (data) => {
    const stats = data.stats || {};
    const daily = stats.daily_attempts || {};
    const days = [], counts = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push(key.slice(5));
      counts.push(daily[key] || 0);
    }
    if (charts.attempts) { charts.attempts.destroy(); charts.attempts = null; }
    if (charts.challenges) { charts.challenges.destroy(); charts.challenges = null; }

    const ctx1 = document.getElementById('chart-attempts');
    const ctx2 = document.getElementById('chart-challenges');
    if (!ctx1 || !ctx2 || typeof Chart === 'undefined') return;

    charts.attempts = new Chart(ctx1.getContext('2d'), {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{ label: 'Blocked', data: counts,
          backgroundColor: 'rgba(129,140,248,0.3)', borderColor: 'rgba(129,140,248,0.8)',
          borderWidth: 1, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', font: { size: 10 } }, beginAtZero: true }
        }
      }
    });
    charts.challenges = new Chart(ctx2.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Successes', 'Failures'],
        datasets: [{ data: [stats.challenge_successes || 0, stats.challenge_failures || 0],
          backgroundColor: ['rgba(110,231,183,0.6)','rgba(248,113,113,0.6)'],
          borderColor: ['rgba(110,231,183,1)','rgba(248,113,113,1)'], borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 11 }, padding: 16 } } }
      }
    });
  });
}

// ── Attempt log ────────────────────────────────────────────────────────────────

function loadLog() {
  chrome.storage.local.get('stats', (data) => {
    const log = (data.stats || {}).attempt_log || [];
    const tbody = document.getElementById('log-tbody');
    if (!tbody) return;
    if (log.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:1.5rem">No attempts recorded yet</td></tr>';
      return;
    }
    tbody.innerHTML = log.map(entry => {
      const d = new Date(entry.time);
      return `<tr><td class="site-cell">${entry.site}</td><td>${d.toLocaleTimeString()}</td><td>${d.toLocaleDateString()}</td></tr>`;
    }).join('');
  });
}

// ── Master load ────────────────────────────────────────────────────────────────

async function loadAll() {
  const data = await chrome.storage.local.get([
    'blocklist','blocking_enabled','stats','challenge_difficulty',
    'password_hash','setup_complete','focus_session','temp_unblock'
  ]);

  blocklist = data.blocklist || ['youtube.com','facebook.com','instagram.com','reddit.com'];
  currentDifficulty = data.challenge_difficulty || 'medium';

  renderTags();
  updateBlocklistCount();
  loadStatus(data);
  loadStats(data.stats);

  // Setup banner
  if (!data.setup_complete) {
    const banner = document.getElementById('setup-banner');
    if (banner) banner.style.display = 'block';
    chrome.storage.local.set({ setup_complete: true });
  }

  // Password cards
  if (data.password_hash) {
    const noCard = document.getElementById('no-password-card');
    const hasCard = document.getElementById('has-password-card');
    if (noCard) noCard.style.display = 'none';
    if (hasCard) hasCard.style.display = 'block';
  }

  // Difficulty cards
  document.querySelectorAll('.diff-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.diff === currentDifficulty);
  });

  // Blocking toggle state
  const toggle = document.getElementById('blocking-toggle');
  if (toggle) {
    if (data.blocking_enabled !== false) {
      toggle.classList.add('on');
    } else {
      toggle.classList.remove('on');
    }
  }

  updateChallengePreview();
}

// ── Wire up all event listeners after DOM is ready ─────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Navigation ──
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const section = item.dataset.section;
      if (!section) return;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      const secEl = document.getElementById('section-' + section);
      if (secEl) secEl.classList.add('active');
      if (section === 'stats') loadCharts();
      if (section === 'log') loadLog();
      if (section === 'challenges') updateChallengePreview();
    });
  });

  // ── Add domain ──
  const addBtn = document.getElementById('btn-add-domain');
  const addInput = document.getElementById('add-domain');
  const dropdown = document.getElementById('autocomplete');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const val = addInput ? addInput.value.trim() : '';
      if (val) {
        addDomain(val);
        addInput.value = '';
        if (dropdown) dropdown.classList.remove('show');
      }
    });
  }

  if (addInput) {
    addInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && addBtn) addBtn.click();
    });

    addInput.addEventListener('input', () => {
      const val = addInput.value.toLowerCase();
      if (!dropdown) return;
      if (!val) { dropdown.classList.remove('show'); return; }
      const matches = COMMON_DOMAINS.filter(d => d.includes(val) && !blocklist.includes(d)).slice(0, 5);
      if (matches.length === 0) { dropdown.classList.remove('show'); return; }
      dropdown.innerHTML = matches.map(d => `<div class="ac-item" data-domain="${d}">${d}</div>`).join('');
      dropdown.classList.add('show');
      dropdown.querySelectorAll('.ac-item').forEach(item => {
        item.addEventListener('click', () => {
          addInput.value = '';
          dropdown.classList.remove('show');
          addDomain(item.dataset.domain);
        });
      });
    });
  }

  document.addEventListener('click', e => {
    if (dropdown && !e.target.closest('.add-input-row')) dropdown.classList.remove('show');
  });

  // ── Reset blocklist ──
  const resetBtn = document.getElementById('btn-reset-list');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset to default blocklist? This will remove any custom sites you added.')) {
        blocklist = ['youtube.com','facebook.com','instagram.com','reddit.com'];
        await chrome.storage.local.set({ blocklist });
        try { await chrome.runtime.sendMessage({ type: 'UPDATE_RULES' }); } catch(e){}
        renderTags();
        updateBlocklistCount();
      }
    });
  }

  // ── Blocking toggle ──
  const toggle = document.getElementById('blocking-toggle');
  if (toggle) {
    toggle.addEventListener('click', async function() {
      const isOn = this.classList.contains('on');
      if (isOn) {
        if (confirm('Disabling blocking requires completing the challenge. Open challenge page?')) {
          chrome.tabs.create({ url: chrome.runtime.getURL('challenge.html') });
        }
      } else {
        this.classList.add('on');
        await chrome.storage.local.set({ blocking_enabled: true });
        try { await chrome.runtime.sendMessage({ type: 'UPDATE_RULES' }); } catch(e){}
      }
    });
  }

  // ── Difficulty cards ──
  document.querySelectorAll('.diff-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      currentDifficulty = card.dataset.diff;
      updateChallengePreview();
    });
  });

  const saveDiffBtn = document.getElementById('save-difficulty');
  if (saveDiffBtn) {
    saveDiffBtn.addEventListener('click', async () => {
      await chrome.storage.local.set({ challenge_difficulty: currentDifficulty });
      saveDiffBtn.textContent = '✓ Saved!';
      setTimeout(() => { saveDiffBtn.textContent = 'Save Difficulty'; }, 2000);
    });
  }

  // ── Password toggle-visibility buttons ──
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // ── Password strength ──
  const pwNewInput = document.getElementById('pw-new');
  if (pwNewInput) {
    pwNewInput.addEventListener('input', () => {
      const val = pwNewInput.value;
      const strengthEl = document.getElementById('pw-strength');
      if (!strengthEl) return;
      strengthEl.className = 'password-strength';
      if (val.length >= 12 && /[A-Z]/.test(val) && /[0-9]/.test(val)) {
        strengthEl.classList.add('strength-strong');
      } else if (val.length >= 8) {
        strengthEl.classList.add('strength-medium');
      } else if (val.length > 0) {
        strengthEl.classList.add('strength-weak');
      }
    });
  }

  // ── Set password ──
  const setPasswordBtn = document.getElementById('btn-set-password');
  if (setPasswordBtn) {
    setPasswordBtn.addEventListener('click', async () => {
      const newPw = document.getElementById('pw-new').value;
      const confirmPw = document.getElementById('pw-confirm').value;
      if (!newPw) return;
      if (newPw !== confirmPw) {
        const errBanner = document.getElementById('pw-error-banner');
        if (errBanner) { errBanner.classList.add('show'); setTimeout(() => errBanner.classList.remove('show'), 3000); }
        return;
      }
      const hash = await hashPassword(newPw);
      await chrome.storage.local.set({ password_hash: hash });
      const successBanner = document.getElementById('pw-success');
      if (successBanner) { successBanner.classList.add('show'); setTimeout(() => successBanner.classList.remove('show'), 3000); }
      const noCard = document.getElementById('no-password-card');
      const hasCard = document.getElementById('has-password-card');
      if (noCard) noCard.style.display = 'none';
      if (hasCard) hasCard.style.display = 'block';
      document.getElementById('pw-new').value = '';
      document.getElementById('pw-confirm').value = '';
    });
  }

  // ── Change password ──
  const changePasswordBtn = document.getElementById('btn-change-password');
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', async () => {
      const currentInput = document.getElementById('pw-current');
      const newInput = document.getElementById('pw-new2');
      if (!currentInput || !newInput) return;
      const current = currentInput.value;
      const newPw = newInput.value;
      const data = await chrome.storage.local.get('password_hash');
      const currentHash = await hashPassword(current);
      if (currentHash !== data.password_hash) { alert('Current password is incorrect.'); return; }
      if (newPw) {
        const hash = await hashPassword(newPw);
        await chrome.storage.local.set({ password_hash: hash });
      } else {
        await chrome.storage.local.remove('password_hash');
        const noCard = document.getElementById('no-password-card');
        const hasCard = document.getElementById('has-password-card');
        if (noCard) noCard.style.display = 'block';
        if (hasCard) hasCard.style.display = 'none';
      }
      const successBanner = document.getElementById('pw-success');
      if (successBanner) { successBanner.classList.add('show'); setTimeout(() => successBanner.classList.remove('show'), 3000); }
      currentInput.value = '';
      newInput.value = '';
    });
  }

  // ── Remove password ──
  const removePasswordBtn = document.getElementById('btn-remove-password');
  if (removePasswordBtn) {
    removePasswordBtn.addEventListener('click', async () => {
      const currentInput = document.getElementById('pw-current');
      if (!currentInput) return;
      const data = await chrome.storage.local.get('password_hash');
      const currentHash = await hashPassword(currentInput.value);
      if (currentHash !== data.password_hash) { alert('Current password is incorrect.'); return; }
      if (confirm('Remove password protection? This makes it easier to bypass blocking.')) {
        await chrome.storage.local.remove('password_hash');
        const noCard = document.getElementById('no-password-card');
        const hasCard = document.getElementById('has-password-card');
        if (noCard) noCard.style.display = 'block';
        if (hasCard) hasCard.style.display = 'none';
        currentInput.value = '';
      }
    });
  }

  // ── Request password reset ──
  const requestResetBtn = document.getElementById('btn-request-reset');
  if (requestResetBtn) {
    requestResetBtn.addEventListener('click', async () => {
      if (confirm('Request a 24-hour password reset? After 24 hours, you can set a new password without knowing the current one.')) {
        try { await chrome.runtime.sendMessage({ type: 'REQUEST_PASSWORD_RESET' }); } catch(e){}
        const statusEl = document.getElementById('reset-status');
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '⏳ Reset requested. Available in 24 hours.'; }
      }
    });
  }

  // ── Clear log ──
  const clearLogBtn = document.getElementById('btn-clear-log');
  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', async () => {
      if (confirm('Clear the attempt log? This cannot be undone.')) {
        const data = await chrome.storage.local.get('stats');
        const stats = data.stats || {};
        stats.attempt_log = [];
        await chrome.storage.local.set({ stats });
        loadLog();
      }
    });
  }

  // ── Kick everything off ──
  loadAll();
});
