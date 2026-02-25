// FocusGuard Background Service Worker

const DEFAULT_BLOCKLIST = [
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'reddit.com'
];

const BLOCKED_PAGE = chrome.runtime.getURL('blocked.html');

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['blocklist', 'blocking_enabled', 'stats', 'challenge_difficulty', 'setup_complete']);
  
  if (!data.blocklist) {
    await chrome.storage.local.set({ blocklist: DEFAULT_BLOCKLIST });
  }
  if (data.blocking_enabled === undefined) {
    await chrome.storage.local.set({ blocking_enabled: true });
  }
  if (!data.stats) {
    await chrome.storage.local.set({
      stats: {
        blocked_attempts: 0,
        challenge_successes: 0,
        challenge_failures: 0,
        daily_attempts: {},
        attempt_log: []
      }
    });
  }
  if (!data.challenge_difficulty) {
    await chrome.storage.local.set({ challenge_difficulty: 'medium' });
  }

  await updateRules();
});

// Update declarativeNetRequest rules based on blocklist
async function updateRules() {
  const data = await chrome.storage.local.get(['blocklist', 'blocking_enabled', 'focus_session']);
  const blocklist = data.blocklist || DEFAULT_BLOCKLIST;
  const enabled = data.blocking_enabled !== false;
  
  // Check if focus session is active (focus session ENABLES blocking temporarily with no bypass)
  const focusSession = data.focus_session;
  const now = Date.now();
  
  // Remove all existing dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existingRules.map(r => r.id);
  
  if (!enabled && (!focusSession || focusSession.end_time < now)) {
    // Blocking disabled and no active focus session
    if (removeIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
    }
    return;
  }

  const rules = [];
  let ruleId = 1;

  for (const domain of blocklist) {
    const cleanDomain = domain.replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
    
    // Block main domain and www variant
    rules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: `${BLOCKED_PAGE}?site=${encodeURIComponent(cleanDomain)}`
        }
      },
      condition: {
        urlFilter: `||${cleanDomain}^`,
        resourceTypes: ['main_frame']
      }
    });

    rules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: `${BLOCKED_PAGE}?site=${encodeURIComponent(cleanDomain)}`
        }
      },
      condition: {
        urlFilter: `||www.${cleanDomain}^`,
        resourceTypes: ['main_frame']
      }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: rules
  });
}

// Listen for storage changes to update rules
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.blocklist || changes.blocking_enabled || changes.focus_session)) {
    updateRules();
  }
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focus_session_end') {
    await chrome.storage.local.remove('focus_session');
    await updateRules();
    // Notify user
    chrome.action.setBadgeText({ text: '' });
  }
  
  if (alarm.name === 'unblock_expire') {
    await chrome.storage.local.set({ blocking_enabled: true });
    await chrome.storage.local.remove('temp_unblock');
    await updateRules();
    chrome.action.setBadgeText({ text: '' });
  }
  
  if (alarm.name === 'password_reset_ready') {
    await chrome.storage.local.set({ password_reset_ready: true });
  }
});

// Log blocked attempt
async function logAttempt(site) {
  const data = await chrome.storage.local.get('stats');
  const stats = data.stats || { blocked_attempts: 0, challenge_successes: 0, challenge_failures: 0, daily_attempts: {}, attempt_log: [] };
  
  stats.blocked_attempts = (stats.blocked_attempts || 0) + 1;
  
  const today = new Date().toISOString().split('T')[0];
  stats.daily_attempts[today] = (stats.daily_attempts[today] || 0) + 1;
  
  // Keep log to last 100 entries
  stats.attempt_log = stats.attempt_log || [];
  stats.attempt_log.unshift({ site, time: Date.now() });
  if (stats.attempt_log.length > 100) stats.attempt_log = stats.attempt_log.slice(0, 100);
  
  await chrome.storage.local.set({ stats });
}

// Message handling
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'LOG_ATTEMPT':
        await logAttempt(msg.site);
        sendResponse({ ok: true });
        break;

      case 'LOG_CHALLENGE':
        const data2 = await chrome.storage.local.get('stats');
        const s2 = data2.stats || {};
        if (msg.success) {
          s2.challenge_successes = (s2.challenge_successes || 0) + 1;
        } else {
          s2.challenge_failures = (s2.challenge_failures || 0) + 1;
        }
        await chrome.storage.local.set({ stats: s2 });
        sendResponse({ ok: true });
        break;

      case 'START_FOCUS_SESSION':
        const endTime = Date.now() + (msg.minutes * 60 * 1000);
        await chrome.storage.local.set({ 
          focus_session: { end_time: endTime, minutes: msg.minutes },
          blocking_enabled: true 
        });
        chrome.alarms.create('focus_session_end', { when: endTime });
        chrome.action.setBadgeText({ text: '🎯' });
        chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
        await updateRules();
        sendResponse({ ok: true });
        break;

      case 'TEMP_UNBLOCK':
        const unblockEnd = Date.now() + (msg.minutes * 60 * 1000);
        await chrome.storage.local.set({ 
          blocking_enabled: false,
          temp_unblock: { end_time: unblockEnd }
        });
        chrome.alarms.create('unblock_expire', { when: unblockEnd });
        chrome.action.setBadgeText({ text: '⏸' });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
        await updateRules();
        sendResponse({ ok: true });
        break;

      case 'UPDATE_RULES':
        await updateRules();
        sendResponse({ ok: true });
        break;

      case 'GET_STATUS':
        const statusData = await chrome.storage.local.get(['blocking_enabled', 'focus_session', 'temp_unblock', 'blocklist', 'stats']);
        sendResponse(statusData);
        break;

      case 'REQUEST_PASSWORD_RESET':
        // Set alarm for 24 hours
        chrome.alarms.create('password_reset_ready', { delayInMinutes: 1440 });
        await chrome.storage.local.set({ password_reset_requested: Date.now() });
        sendResponse({ ok: true });
        break;
    }
  })();
  return true; // Keep message channel open
});
