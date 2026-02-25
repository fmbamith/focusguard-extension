const QUOTES = [
  "The successful warrior is the average person, with laser-like focus. — Bruce Lee",
  "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.",
  "You don't need more time. You need to decide. — Seth Godin",
  "Deep work is the ability to focus without distraction on a cognitively demanding task.",
  "The ability to focus attention on important things is a defining characteristic of intelligence.",
  "What you focus on expands. Choose wisely.",
  "Productivity is never an accident. It is always the result of commitment to excellence.",
  "Do the hard jobs first. The easy jobs will take care of themselves.",
  "Focus is a matter of deciding what things you're NOT going to do.",
  "One reason so few of us achieve what we truly want is that we never direct our focus.",
  "You are what you repeatedly do. Excellence is not an act, but a habit.",
  "The secret of getting ahead is getting started.",
];

let quoteIdx = Math.floor(Math.random() * QUOTES.length);

function showQuote() {
  const el = document.getElementById('quote-text');
  el.classList.add('fade-out');
  setTimeout(() => {
    quoteIdx = (quoteIdx + 1) % QUOTES.length;
    el.textContent = '\u201c' + QUOTES[quoteIdx] + '\u201d';
    el.classList.remove('fade-out');
  }, 500);
}

document.addEventListener('DOMContentLoaded', () => {
  // Show first quote
  document.getElementById('quote-text').textContent = '\u201c' + QUOTES[quoteIdx] + '\u201d';
  setInterval(showQuote, 8000);

  // Get blocked site from URL params
  const params = new URLSearchParams(window.location.search);
  const site = params.get('site') || 'this site';
  document.getElementById('site-badge').textContent = site;

  // Log the attempt
  try {
    chrome.runtime.sendMessage({ type: 'LOG_ATTEMPT', site });
  } catch(e) {}

  // Load stats
  chrome.storage.local.get('stats', (data) => {
    const stats = data.stats || {};
    const today = new Date().toISOString().split('T')[0];
    const todayCount = (stats.daily_attempts || {})[today] || 0;
    document.getElementById('stat-blocked').textContent = todayCount;
    const days = Object.keys(stats.daily_attempts || {});
    document.getElementById('stat-streak').textContent = days.length;
    document.getElementById('stats-row').style.display = 'flex';
  });

  // Time display
  function updateTime() {
    document.getElementById('time-display').textContent =
      new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
      ' \u00b7 ' +
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  updateTime();
  setInterval(updateTime, 30000);

  // Back button
  document.getElementById('btn-back').addEventListener('click', () => {
    if (history.length > 1) {
      history.back();
    } else {
      window.location.href = 'https://www.google.com';
    }
  });

  // Unblock button — open challenge page
  document.getElementById('btn-unblock').addEventListener('click', () => {
    const site = new URLSearchParams(window.location.search).get('site') || '';
    window.location.href = chrome.runtime.getURL('challenge.html') + '?from=' + encodeURIComponent(site);
  });
});
