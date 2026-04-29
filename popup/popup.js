const SETTINGS_KEYS = [
  'wideMode', 'compactMode', 'commentColors', 'collapseBots',
  'accentColor', 'keyboardNav', 'smoothScroll', 'focusMode', 'undertaleTheme'
];

const DEFAULTS = {
  darkMode: true,
  accentColor: '#10b981',
  compactMode: false,
  keyboardNav: true,
  autoExpandImages: false,
  cleanSidebar: true,
  wideMode: true,
  smoothScroll: true,
  commentColors: true,
  collapseBots: true,
  focusMode: false,
  undertaleTheme: false,
  userTags: {}
};

function loadAndApply() {
  chrome.storage.sync.get(DEFAULTS, data => {
    SETTINGS_KEYS.forEach(key => {
      const el = document.getElementById(key);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = data[key];
      else if (el.type === 'color') el.value = data[key];
    });
  });
}

function save(key, value) {
  const update = {};
  update[key] = value;
  chrome.storage.sync.set(update, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('reddit.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'settingsUpdated' });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadAndApply();

  SETTINGS_KEYS.forEach(key => {
    const el = document.getElementById(key);
    if (!el) return;

    el.addEventListener('change', () => {
      if (el.type === 'checkbox') save(key, el.checked);
      else if (el.type === 'color') save(key, el.value);
    });
  });
});
