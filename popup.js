let selectedSessionMinutes = 0;
let timerInterval = null;

function selectSession(mins, el) {
  selectedSessionMinutes = mins;
  document.querySelectorAll('.session-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('start-session-btn').disabled = false;
  document.getElementById('start-session-btn').textContent = `Start ${mins}-min Session`;
}

function closeModal() {
  document.getElementById('session-modal').classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  // Session option clicks
  document.querySelectorAll('.session-opt').forEach(opt => {
    opt.addEventListener('click', function() {
      selectSession(parseInt(this.dataset.mins), this);
    });
  });

  document.getElementById('btn-focus').addEventListener('click', () => {
    document.getElementById('session-modal').classList.add('show');
  });

  document.getElementById('start-session-btn').addEventListener('click', async () => {
    if (!selectedSessionMinutes) return;
    await chrome.runtime.sendMessage({ type: 'START_FOCUS_SESSION', minutes: selectedSessionMinutes });
    closeModal();
    loadStatus();
  });

  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  });

  document.getElementById('btn-unblock-link').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('challenge.html') });
  });

  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  loadStatus();
});

async function loadStatus() {
  try {
    const data = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    const stats = data.stats || {};
    const today = new Date().toISOString().split('T')[0];
    const todayCount = (stats.daily_attempts || {})[today] || 0;

    document.getElementById('stat-today').textContent = todayCount;
    document.getElementById('stat-sites').textContent = (data.blocklist || []).length;
    document.getElementById('stat-total').textContent = stats.blocked_attempts || 0;

    const pill = document.getElementById('status-pill');
    if (data.focus_session && data.focus_session.end_time > Date.now()) {
      pill.className = 'status-pill status-focus';
      pill.textContent = '🎯 Focusing';
      showTimer('Focus Session', data.focus_session.end_time, data.focus_session.minutes);
    } else if (data.temp_unblock && data.temp_unblock.end_time > Date.now()) {
      pill.className = 'status-pill status-paused';
      pill.textContent = '⏸ Paused';
      showTimer('Break ends in', data.temp_unblock.end_time, null);
    } else if (data.blocking_enabled !== false) {
      pill.className = 'status-pill status-active';
      pill.textContent = '● Active';
      hideTimer();
    } else {
      pill.className = 'status-pill status-paused';
      pill.textContent = '⏸ Paused';
      hideTimer();
    }

    // Recent blocks
    const listEl = document.getElementById('blocked-list');
    const counts = {};
    (stats.attempt_log || []).filter(e => {
      return new Date(e.time).toISOString().split('T')[0] === today;
    }).forEach(e => {
      counts[e.site] = (counts[e.site] || 0) + 1;
    });

    const topSites = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    if (topSites.length === 0) {
      listEl.innerHTML = '<div class="blocked-item" style="color:var(--muted);font-size:0.78rem">No blocks today</div>';
    } else {
      listEl.innerHTML = topSites.map(([site, count]) => `
        <div class="blocked-item">
          <span class="blocked-domain">${site}</span>
          <span class="blocked-count">${count}×</span>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('FocusGuard popup error:', err);
  }
}

function showTimer(label, endTime, totalMinutes) {
  const bar = document.getElementById('timer-bar');
  bar.classList.add('show');
  clearInterval(timerInterval);
  const totalMs = totalMinutes ? totalMinutes * 60 * 1000 : (endTime - Date.now());

  function update() {
    const remaining = Math.max(0, endTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    document.getElementById('timer-remaining').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('timer-label-text').textContent = label;
    const pct = Math.min(100, (remaining / totalMs) * 100);
    document.getElementById('timer-fill').style.width = pct + '%';
    if (remaining <= 0) {
      clearInterval(timerInterval);
      hideTimer();
      loadStatus();
    }
  }

  update();
  timerInterval = setInterval(update, 1000);
}

function hideTimer() {
  document.getElementById('timer-bar').classList.remove('show');
  clearInterval(timerInterval);
}
