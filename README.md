# 🛡️ FocusGuard — Stay Locked In

A powerful Chrome extension that blocks distracting websites with a **friction-based unblocking system** designed to make bypassing your focus goals genuinely difficult.


---

## Features

- 🚫 **Blocks by default:** YouTube, Facebook, Instagram, Reddit (fully customizable)
- 🔐 **Hard unblocking:** Multi-step challenge flow with math puzzles, quote typing, countdown timers, and optional password protection
- 🎯 **Focus Sessions:** Timed focus periods (25/45/60/90 min) — canceling early requires the full challenge
- ⏱️ **Timed breaks:** Unlock for 5–30 minutes, then blocking auto re-enables
- 📊 **Statistics:** Daily block counts, attempt logs, challenge outcome charts
- 🌙 **Dark UI:** Glassmorphism design with smooth animations

## Screenshots

<img width="261" height="294" alt="image" src="https://github.com/user-attachments/assets/0c38c88a-7853-4c8f-912f-d0c5f7b7444e" />
<img width="960" height="411" alt="image" src="https://github.com/user-attachments/assets/e6105b59-a577-423f-af8e-40a7ce240284" />
<img width="960" height="407" alt="image" src="https://github.com/user-attachments/assets/af5f235a-bde2-4c14-9a19-af2f022412be" />
<img width="958" height="408" alt="image" src="https://github.com/user-attachments/assets/235392de-5a94-4f43-96ea-bab87fce3f48" />
<img width="960" height="407" alt="image" src="https://github.com/user-attachments/assets/ac73ab4e-b765-41fe-80d7-d3bbea5fa368" />
<img width="922" height="420" alt="image" src="https://github.com/user-attachments/assets/a663f51c-d8e1-4b13-b0e1-5fe2b458a24c" />





## Installation
NB : the previous update folders should be delted from your file explorer and the extension of the previous version also should be deleted before downloading this. 

This extension is not on the Chrome Web Store. Install it manually in Developer Mode:

1. Download by clicking the releases option (V.2.0) and click 'focus-guard-extension.zip'.
2. extract the zip and open it. It will contain a folder.
3. copy the folder and paste into a place which is easy to find.
4. Go to `chrome://extensions` in Chrome
5. Enable **Developer Mode** (toggle in top-right)
6. Click **Load unpacked**
7. add the folder into it.
8. you can see the extension in the extension bar.


## How It Works

When you visit a blocked site, you're redirected to a full-screen motivational page. To get through, you must:

1. **Enter your master password** (if set)
2. **Solve a math problem** (with increasing delays on wrong answers)
3. **Type a commitment phrase** exactly as shown
4. **Wait out a countdown timer** (30s on Medium, 60s on Hard)
5. **Choose a break duration** — blocking resumes automatically

## Difficulty Levels

| Level | Steps |
|-------|-------|
| Easy | Math puzzle |
| Medium | Math + quote typing + 30s timer |
| Hard | Password + math + quote + 60s timer |

## Tech Stack

- Manifest V3
- `declarativeNetRequest` for hard redirects
- `chrome.storage.local` for persistence
- `chrome.alarms` for auto re-enable timers
- SHA-256 password hashing via Web Crypto API
- Chart.js for statistics
- Pure HTML/CSS/JS — no build step needed

## License

MIT


