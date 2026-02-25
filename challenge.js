const QUOTE_PROMPTS = [
  "I am choosing distraction over my goals",
  "I acknowledge this is not productive",
  "My future self will thank me for focusing",
  "Distraction is the enemy of achievement",
];

const CIRCUMFERENCE = 2 * Math.PI * 45; // ~283

let currentStep = 0;
let steps = [];
let difficulty = 'medium';
let mathAnswer = 0;
let selectedDurationValue = 0;
let failureCount = 0;
let timerInterval = null;

async function init() {
  const data = await chrome.storage.local.get(['challenge_difficulty', 'password_hash', 'stats']);
  difficulty = data.challenge_difficulty || 'medium';
  const hasPassword = !!data.password_hash;
  const stats = data.stats || {};
  const today = new Date().toISOString().split('T')[0];
  const todayAttempts = (stats.daily_attempts || {})[today] || 0;
  document.getElementById('confirm-attempts').textContent = todayAttempts;

  steps = [];
  if (hasPassword) steps.push('password');

  if (difficulty === 'easy') {
    steps.push('math', 'confirm');
  } else {
    // medium + hard
    steps.push('math', 'quote', 'timer', 'confirm');
  }
  steps.push('done');

  // Build progress bar dots
  const bar = document.getElementById('progress-bar');
  bar.innerHTML = '';
  steps.slice(0, -1).forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    dot.id = 'dot-' + i;
    bar.appendChild(dot);
  });

  setupMath();
  setupQuote();
  showStep(0);
}

function setupMath() {
  const a = Math.floor(Math.random() * 50) + 10;
  const b = Math.floor(Math.random() * 50) + 10;
  const c = Math.floor(Math.random() * 30) + 5;
  document.getElementById('math-problem').textContent = a + ' + ' + b + ' + ' + c + ' = ?';
  mathAnswer = a + b + c;
}

function setupQuote() {
  const quote = QUOTE_PROMPTS[Math.floor(Math.random() * QUOTE_PROMPTS.length)];
  document.getElementById('quote-prompt').textContent = quote;
  document.getElementById('quote-input').setAttribute('data-target', quote);
}

function showStep(idx) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const stepName = steps[idx];
  document.getElementById('step-' + stepName).classList.add('active');

  steps.slice(0, -1).forEach((_, i) => {
    const dot = document.getElementById('dot-' + i);
    if (!dot) return;
    dot.classList.remove('done', 'active');
    if (i < idx) dot.classList.add('done');
    else if (i === idx) dot.classList.add('active');
  });

  if (stepName === 'timer') startTimer();
  currentStep = idx;
}

function nextStep() {
  if (currentStep < steps.length - 1) {
    showStep(currentStep + 1);
  }
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'focusguard_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function startTimer() {
  const totalSeconds = difficulty === 'hard' ? 60 : 30;
  let remaining = totalSeconds;
  const btn = document.getElementById('timer-btn');
  const fill = document.getElementById('timer-fill');
  const countEl = document.getElementById('timer-seconds');

  fill.style.strokeDasharray = CIRCUMFERENCE;
  fill.style.strokeDashoffset = '0';
  btn.disabled = true;
  btn.textContent = 'Waiting...';

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remaining--;
    const progress = remaining / totalSeconds;
    fill.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    countEl.textContent = remaining;

    if (remaining <= 10) {
      fill.style.stroke = 'var(--danger)';
      countEl.style.color = 'var(--danger)';
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      btn.disabled = false;
      btn.textContent = 'Continue \u2192';
      countEl.textContent = '\u2713';
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  // Password step
  document.getElementById('toggle-pw').addEventListener('click', () => {
    const input = document.getElementById('pw-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('pw-submit').addEventListener('click', async () => {
    const val = document.getElementById('pw-input').value;
    const data = await chrome.storage.local.get('password_hash');
    const hash = await hashPassword(val);
    if (hash === data.password_hash) {
      document.getElementById('pw-input').classList.remove('error');
      document.getElementById('pw-input').classList.add('success');
      setTimeout(nextStep, 400);
    } else {
      failureCount++;
      chrome.runtime.sendMessage({ type: 'LOG_CHALLENGE', success: false });
      document.getElementById('pw-input').classList.add('error');
      document.getElementById('pw-error').classList.add('show');
      setTimeout(() => document.getElementById('pw-input').classList.remove('error'), 500);
      if (failureCount >= 3) {
        const btn = document.getElementById('pw-submit');
        btn.disabled = true;
        document.getElementById('pw-error').textContent = 'Too many attempts. Wait ' + (failureCount * 15) + 's...';
        setTimeout(() => {
          btn.disabled = false;
          document.getElementById('pw-error').textContent = 'Incorrect password. Try again.';
        }, failureCount * 15000);
      }
    }
  });

  document.getElementById('pw-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('pw-submit').click();
  });

  // Math step
  document.getElementById('math-submit').addEventListener('click', () => {
    const val = parseInt(document.getElementById('math-input').value);
    if (val === mathAnswer) {
      document.getElementById('math-input').classList.add('success');
      setTimeout(nextStep, 400);
    } else {
      failureCount++;
      chrome.runtime.sendMessage({ type: 'LOG_CHALLENGE', success: false });
      document.getElementById('math-input').classList.add('error');
      const msg = (mathAnswer - val > 0) ? 'Too low!' : 'Too high!';
      document.getElementById('math-error').textContent = 'Wrong answer. ' + msg;
      document.getElementById('math-error').classList.add('show');
      setTimeout(() => document.getElementById('math-input').classList.remove('error'), 500);
      if (failureCount >= 3) {
        const btn = document.getElementById('math-submit');
        btn.disabled = true;
        document.getElementById('math-error').textContent = failureCount + ' failures. Waiting 20 seconds...';
        setTimeout(() => {
          btn.disabled = false;
          setupMath();
          document.getElementById('math-input').value = '';
          document.getElementById('math-error').textContent = '';
          document.getElementById('math-error').classList.remove('show');
        }, 20000);
      }
    }
  });

  document.getElementById('math-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('math-submit').click();
  });

  // Quote step
  document.getElementById('quote-submit').addEventListener('click', () => {
    const input = document.getElementById('quote-input');
    const target = input.getAttribute('data-target');
    if (input.value === target) {
      input.classList.add('success');
      setTimeout(nextStep, 400);
    } else {
      chrome.runtime.sendMessage({ type: 'LOG_CHALLENGE', success: false });
      input.classList.add('error');
      document.getElementById('quote-error').classList.add('show');
      input.value = '';
      setTimeout(() => input.classList.remove('error'), 500);
    }
  });

  document.getElementById('quote-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('quote-submit').click();
  });

  document.getElementById('quote-input').addEventListener('input', () => {
    const input = document.getElementById('quote-input');
    const target = input.getAttribute('data-target');
    document.getElementById('quote-error').classList.remove('show');
    input.style.borderColor = (!input.value || target.startsWith(input.value)) ? '' : 'rgba(248,113,113,0.3)';
  });

  // Timer step
  document.getElementById('timer-btn').addEventListener('click', () => {
    if (!document.getElementById('timer-btn').disabled) nextStep();
  });

  // Duration buttons
  document.querySelectorAll('.duration-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      selectedDurationValue = parseInt(this.dataset.mins);
      document.querySelectorAll('.duration-btn').forEach(b => {
        b.style.borderColor = '';
        b.style.color = '';
      });
      this.style.borderColor = 'var(--accent)';
      this.style.color = 'var(--accent)';
      const confirmBtn = document.getElementById('confirm-unblock');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Pause blocking for ' + selectedDurationValue + ' minutes';
    });
  });

  // Confirm unblock
  document.getElementById('confirm-unblock').addEventListener('click', async () => {
    if (!selectedDurationValue) return;
    const btn = document.getElementById('confirm-unblock');
    btn.disabled = true;
    btn.textContent = 'Unlocking...';

    await chrome.runtime.sendMessage({ type: 'TEMP_UNBLOCK', minutes: selectedDurationValue });
    await chrome.runtime.sendMessage({ type: 'LOG_CHALLENGE', success: true });

    document.getElementById('done-minutes').textContent = selectedDurationValue;

    const data = await chrome.storage.local.get('stats');
    const log = ((data.stats || {}).attempt_log || []).slice(0, 5);
    if (log.length) {
      const logText = log.map(e => e.site + ' \u2014 ' + new Date(e.time).toLocaleTimeString()).join(' \u00b7 ');
      document.getElementById('attempt-log-text').textContent = 'Recent: ' + logText;
    }

    showStep(steps.indexOf('done'));
  });

  // Done step close
  document.getElementById('done-close').addEventListener('click', () => {
    window.close();
    setTimeout(() => { window.location.href = 'https://www.google.com'; }, 200);
  });

  // Cancel button
  document.getElementById('btn-cancel').addEventListener('click', () => {
    if (history.length > 1) history.go(-2);
    else window.location.href = 'https://www.google.com';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('btn-cancel').click();
  });

  init();
});
