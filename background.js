chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    darkMode: true,
    accentColor: '#7c5cff',
    removeAds: true,
    blurNSFW: true,
    compactMode: false,
    keyboardNav: true,
    autoExpandImages: false,
    showReadingTime: true,
    cleanSidebar: true,
    wideMode: true,
    smoothScroll: true,
    commentColors: true,
    collapseBots: true,
    focusMode: false,
    userTags: {}
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('reddit.com')) {
    chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
  }
});
