(function () {
  'use strict';

  const SETTINGS_DEFAULTS = {
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

  let settings = { ...SETTINGS_DEFAULTS };
  let currentPostIndex = -1;
  let allPosts = [];
  let commandPaletteActive = false;

  function loadSettings() {
    return new Promise(resolve => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(SETTINGS_DEFAULTS, data => {
          settings = { ...SETTINGS_DEFAULTS, ...data };
          resolve(settings);
        });
      } else {
        const saved = localStorage.getItem('rr-settings');
        if (saved) settings = { ...SETTINGS_DEFAULTS, ...JSON.parse(saved) };
        resolve(settings);
      }
    });
  }

  function saveSettings() {
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set(settings);
    } else {
      localStorage.setItem('rr-settings', JSON.stringify(settings));
    }
  }

  function createFloatingHeaderMenu() {
    if (document.getElementById('rr-floating-header')) return;

    if (!document.getElementById('rr-hide-header-style')) {
      const s = document.createElement('style');
      s.id = 'rr-hide-header-style';
      s.textContent = `
        shreddit-app > header:first-of-type, reddit-header-large, #profile-header-compact, .profile-header-compact { 
           height: 1px !important; 
           overflow: visible !important; 
           opacity: 0 !important;
           pointer-events: none !important;
           position: absolute !important;
           top: -100px !important;
        }
        shreddit-app { --nav-height: 0px !important; padding-top: 0 !important; }
        #main-content { margin-top: 16px !important; }

        /* Constrain extracted Native Elements to prevent wide UI breaking */
        #rr-floating-header > div:not(#rr-search-bubble),
        #rr-floating-header > span,
        #rr-floating-header > rpl-dropdown,
        #rr-floating-header > rpl-tooltip,
        #rr-floating-header > activate-feature {
            flex: 0 0 auto !important;
            width: max-content !important;
            min-width: unset !important;
            max-width: max-content !important;
            display: flex !important;
            align-items: center !important;
        }
        
        #rr-floating-header [data-part] {
            display: contents !important;
        }

        #rr-floating-header .w-\\[40px\\], #rr-floating-header .max-w-\\[40px\\] {
            width: 40px !important;
            max-width: 40px !important;
        }

        #rr-search-bubble search-dynamic-id-cache-controller,
        #rr-search-bubble reddit-search-large,
        #rr-search-bubble form {
           width: 250px !important;
           max-width: 250px !important;
           margin: 0 !important;
        }

        /* WIDE MODE - BULLETPROOF NO EMPTY SPACE ON FULLSCREEN */
        @media screen and (min-width: 0px) {
            html body.rr-wide-mode shreddit-app,
            html body.rr-wide-mode [class*="grid-container"],
            html body.rr-wide-mode main,
            html body.rr-wide-mode .subgrid-container,
            html body.rr-wide-mode [class*="max-w-"] {
              display: block !important;
              max-width: 100vw !important;
              width: 100vw !important;
              padding: 0 !important;
              margin: 0 !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
              left: 0 !important;
              transform: none !important;
            }
            html body.rr-wide-mode shreddit-app * { --canvas-width: 100vw !important; }
            html body.rr-wide-mode flex-left-nav-container,
            html body.rr-wide-mode #flex-left-nav-container,
            html body.rr-wide-mode #left-sidebar-container { display: none !important; }
            html body.rr-wide-mode shreddit-feed,
            html body.rr-wide-mode shreddit-post,
            html body.rr-wide-mode .Post,
            html body.rr-wide-mode article,
            html body.rr-wide-mode shreddit-comment-tree,
            html body.rr-wide-mode [data-testid="comment-tree"],
            html body.rr-wide-mode comment-body-header,
            html body.rr-wide-mode [data-testid="post-container"] {
              display: block !important;
              max-width: 100vw !important;
              width: 100vw !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
              box-sizing: border-box !important;
              left: 0 !important;
              transform: none !important;
            }
        }

        /* Prevent floating UI overlap on narrow screens */
        @media screen and (max-width: 900px) {
            #rr-quick-subs[style*="top: 24px"] {
                top: 80px !important;
            }
        }
      `;
      document.head.appendChild(s);
    }

    const menu = document.createElement('div');
    menu.id = 'rr-floating-header';
    menu.style.cssText = 'position:fixed;top:24px;right:24px;z-index:999999;display:flex;gap:4px;background:var(--rr-bg-elevated);padding:4px 8px;border-radius:30px;box-shadow:0 10px 30px rgba(0,0,0,0.5);border:1px solid var(--rr-border);backdrop-filter:blur(10px);align-items:center;';

    // Search Icon inside the floating header
    const searchIcon = document.createElement('div');
    searchIcon.innerHTML = '🔍';
    searchIcon.style.cssText = 'cursor:pointer;font-size:18px;display:flex;align-items:center;padding:8px;opacity:0.8;';
    searchIcon.onmouseenter = () => searchIcon.style.opacity = '1';
    searchIcon.onmouseleave = () => searchIcon.style.opacity = '0.8';

    // The bubble that holds the native search bar
    const searchBubble = document.createElement('div');
    searchBubble.id = 'rr-search-bubble';
    searchBubble.style.cssText = 'position:absolute;top:54px;right:0;background:var(--rr-bg-elevated);border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,0.5);border:1px solid var(--rr-border);display:none;padding:4px;width:max-content;backdrop-filter:blur(10px);z-index:999999;';

    searchIcon.onclick = () => {
      searchBubble.style.display = searchBubble.style.display === 'none' ? 'block' : 'none';
      if (searchBubble.style.display === 'block') {
        const input = searchBubble.querySelector('input');
        if (input) input.focus();
      }
    };

    menu.appendChild(searchIcon);
    menu.appendChild(searchBubble);

    const grabIcons = setInterval(() => {
      const createEl = document.querySelector('[data-part="create"], create-post-entry-point-wrapper');
      const chatEl = document.querySelector('[data-part="chat"]');
      const inboxEl = document.querySelector('[data-part="inbox"]');
      const searchEl = document.querySelector('search-dynamic-id-cache-controller, reddit-search-large');

      let userDropdown = null;
      const userBtn = document.querySelector('#expand-user-drawer-button');
      if (userBtn) {
        userDropdown = userBtn.closest('.flex.items-center.justify-center.w-\\[40px\\].h-\\[40px\\]') || userBtn.closest('rpl-dropdown') || userBtn.closest('div');
      }

      if (createEl || chatEl || inboxEl || searchEl || userDropdown) {
        clearInterval(grabIcons);

        if (searchEl) {
          searchBubble.appendChild(searchEl);
        }
        if (createEl) menu.appendChild(createEl);
        if (chatEl) menu.appendChild(chatEl);
        if (inboxEl) menu.appendChild(inboxEl);
        if (userDropdown) menu.appendChild(userDropdown);
      }
    }, 500);

    setTimeout(() => clearInterval(grabIcons), 10000);

    document.body.appendChild(menu);
  }

  function applySettingsToDOM() {
    document.body.classList.toggle('rr-wide-mode', settings.wideMode);
    document.body.classList.toggle('rr-compact', settings.compactMode);
    document.body.classList.toggle('rr-smooth-scroll', settings.smoothScroll);
    document.body.classList.toggle('rr-comment-colors', settings.commentColors);
    document.body.classList.toggle('rr-focus-mode', settings.focusMode);

    if (settings.undertaleTheme) {
      document.body.classList.add('rr-undertale');
      if (!document.getElementById('rr-undertale-font')) {
        const link = document.createElement('link');
        link.id = 'rr-undertale-font';
        link.href = 'https://fonts.googleapis.com/css2?family=VT323&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      if (!document.getElementById('rr-undertale-styles')) {
        const style = document.createElement('style');
        style.id = 'rr-undertale-styles';
        style.textContent = `
                body.rr-undertale * { font-family: 'VT323', monospace !important; }
                body.rr-undertale, body.rr-undertale shreddit-app, body.rr-undertale #main-content, 
                body.rr-undertale [class*="bg-neutral-background"], body.rr-undertale shreddit-post, body.rr-undertale shreddit-comment {
                     background: #000 !important; color: #fff !important; 
                     --color-neutral-background: #000 !important;
                     --color-neutral-content: #fff !important;
                     --color-secondary-background: #000 !important;
                }
                body.rr-undertale shreddit-post, body.rr-undertale shreddit-comment, body.rr-undertale #rr-floating-header {
                     border: 3px solid #fff !important; 
                     border-radius: 0 !important;
                     box-shadow: none !important;
                     margin-bottom: 24px !important;
                }
                body.rr-undertale button, body.rr-undertale [role="button"] { 
                     border: 2px solid #fff !important; 
                     background: #000 !important; 
                     color: #fca5a5 !important; 
                     text-transform: uppercase !important; 
                     border-radius: 0 !important; 
                }
                body.rr-undertale button:hover, body.rr-undertale [role="button"]:hover {
                     background: #fff !important; color: #000 !important;
                }
                body.rr-undertale button[upvote] svg, body.rr-undertale button[downvote] svg { display: none !important; }
                body.rr-undertale button[upvote]::before { content: '❤️'; font-size: 16px; }
                body.rr-undertale button[downvote]::before { content: '🖤'; font-size: 16px; }
                body.rr-undertale a { color: #facc15 !important; text-decoration: underline !important; }
            `;
        document.head.appendChild(style);
      }
    } else {
      document.body.classList.remove('rr-undertale');
      const style = document.getElementById('rr-undertale-styles');
      if (style) style.remove();
    }

    if (settings.accentColor && settings.accentColor !== '#10b981') {
      document.documentElement.style.setProperty('--rr-accent', settings.accentColor);
      const r = parseInt(settings.accentColor.slice(1, 3), 16);
      const g = parseInt(settings.accentColor.slice(3, 5), 16);
      const b = parseInt(settings.accentColor.slice(5, 7), 16);
      document.documentElement.style.setProperty('--rr-accent-glow', `rgba(${r},${g},${b},0.25)`);
      document.documentElement.style.setProperty('--rr-accent-subtle', `rgba(${r},${g},${b},0.08)`);
      document.documentElement.style.setProperty('--rr-accent-hover', adjustColor(settings.accentColor, 25));
      document.documentElement.style.setProperty('--rr-border-hover', `rgba(${r},${g},${b},0.3)`);
    } else {
      document.documentElement.style.setProperty('--rr-accent', '#10b981');
      document.documentElement.style.setProperty('--rr-accent-glow', `rgba(16,185,129,0.25)`);
      document.documentElement.style.setProperty('--rr-accent-subtle', `rgba(16,185,129,0.08)`);
      document.documentElement.style.setProperty('--rr-accent-hover', '#059669');
      document.documentElement.style.setProperty('--rr-border-hover', `rgba(16,185,129,0.3)`);
    }

    injectShadowStyles();
  }

  function adjustColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }



  function createReadingProgressBar() {
    if (document.getElementById('rr-reading-progress')) return;
    const bar = document.createElement('div');
    bar.id = 'rr-reading-progress';
    bar.style.width = '0%';
    document.body.appendChild(bar);

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = progress + '%';
    }, { passive: true });
  }

  function createScrollTopButton() {
    if (document.getElementById('rr-scroll-top')) return;
    const btn = document.createElement('button');
    btn.id = 'rr-scroll-top';
    btn.innerHTML = '↑';
    btn.title = 'Scroll to top';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 600);
    }, { passive: true });
  }

  function createFAB() {
    if (document.getElementById('rr-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'rr-fab';
    fab.title = 'Rebbit Restyle — Ctrl+K for commands';
    fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
    document.body.appendChild(fab);
    fab.addEventListener('click', toggleCommandPalette);
  }

  function createToastContainer() {
    if (document.getElementById('rr-toast-container')) return;
    const container = document.createElement('div');
    container.id = 'rr-toast-container';
    document.body.appendChild(container);
  }

  function showToast(message, duration = 2500) {
    const container = document.getElementById('rr-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'rr-toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('rr-toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function createCommandPalette() {
    if (document.getElementById('rr-command-palette')) return;

    const overlay = document.createElement('div');
    overlay.id = 'rr-command-palette';
    overlay.innerHTML = `
      <div id="rr-command-palette-inner">
        <input id="rr-command-input" type="text" placeholder="Type a command... (subreddit, setting, action)" autocomplete="off" />
        <div id="rr-command-results"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeCommandPalette();
    });

    const input = document.getElementById('rr-command-input');
    input.addEventListener('input', () => renderCommandResults(input.value));
    input.addEventListener('keydown', handleCommandKeydown);
  }

  function getCommands(query) {
    const q = query.toLowerCase().trim();
    const commands = [
      { icon: '🏠', label: 'Go to Home', action: () => window.location.href = 'https://www.reddit.com/' },
      { icon: '📐', label: 'Toggle Compact Mode', shortcut: 'Alt+C', action: () => { settings.compactMode = !settings.compactMode; saveSettings(); applySettingsToDOM(); showToast(`Compact: ${settings.compactMode ? 'ON' : 'OFF'}`); } },
      { icon: '↔️', label: 'Toggle Wide Mode', shortcut: 'Alt+W', action: () => { settings.wideMode = !settings.wideMode; saveSettings(); applySettingsToDOM(); showToast(`Wide: ${settings.wideMode ? 'ON' : 'OFF'}`); } },
      { icon: '🧘', label: 'Toggle Focus Mode', shortcut: 'Alt+F', action: () => { settings.focusMode = !settings.focusMode; saveSettings(); applySettingsToDOM(); showToast(`Focus: ${settings.focusMode ? 'ON' : 'OFF'}`); } },
      { icon: '🔞', label: 'Toggle NSFW Blur', action: () => { settings.blurNSFW = !settings.blurNSFW; saveSettings(); applySettingsToDOM(); showToast(`NSFW Blur: ${settings.blurNSFW ? 'ON' : 'OFF'}`); } },
      { icon: '🤖', label: 'Collapse Bot Comments', action: () => { settings.collapseBots = !settings.collapseBots; saveSettings(); collapseBotComments(); showToast(`Collapse Bots: ${settings.collapseBots ? 'ON' : 'OFF'}`); } },
      { icon: '🌈', label: 'Toggle Comment Colors', action: () => { settings.commentColors = !settings.commentColors; saveSettings(); applySettingsToDOM(); showToast(`Comment colors: ${settings.commentColors ? 'ON' : 'OFF'}`); } },
      { icon: '🧹', label: 'Remove All Ads Now', action: () => { removeAds(); showToast('Ads removed'); } },
      { icon: '⬆️', label: 'Scroll to Top', shortcut: 'Home', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
      { icon: '⬇️', label: 'Scroll to Bottom', shortcut: 'End', action: () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }) },
      { icon: '📋', label: 'Copy Post URL', action: () => { navigator.clipboard.writeText(window.location.href); showToast('URL copied'); } },
      { icon: '📖', label: 'Toggle Reading Time', action: () => { settings.showReadingTime = !settings.showReadingTime; saveSettings(); showToast(`Reading time: ${settings.showReadingTime ? 'ON' : 'OFF'}`); } },
    ];

    if (q.startsWith('r/') || q.startsWith('/r/')) {
      const sub = q.replace(/^\//, '');
      commands.unshift({
        icon: '🔗',
        label: `Go to ${sub}`,
        action: () => window.location.href = `https://www.reddit.com/${sub}/`
      });
    } else if (q.startsWith('u/') || q.startsWith('/u/')) {
      const user = q.replace(/^\//, '');
      commands.unshift({
        icon: '👤',
        label: `Go to ${user}`,
        action: () => window.location.href = `https://www.reddit.com/${user}/`
      });
    }

    if (!q) return commands;
    return commands.filter(c => c.label.toLowerCase().includes(q));
  }

  function renderCommandResults(query) {
    const container = document.getElementById('rr-command-results');
    if (!container) return;
    const commands = getCommands(query);
    container.innerHTML = '';
    commands.forEach((cmd, i) => {
      const item = document.createElement('div');
      item.className = 'rr-command-item' + (i === 0 ? ' active' : '');
      item.innerHTML = `<span class="rr-cmd-icon">${cmd.icon}</span><span>${cmd.label}</span>${cmd.shortcut ? `<span class="rr-cmd-shortcut">${cmd.shortcut}</span>` : ''}`;
      item.addEventListener('click', () => { cmd.action(); closeCommandPalette(); });
      container.appendChild(item);
    });
  }

  function handleCommandKeydown(e) {
    const items = document.querySelectorAll('.rr-command-item');
    let activeIdx = Array.from(items).findIndex(i => i.classList.contains('active'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[activeIdx]?.classList.remove('active');
      activeIdx = (activeIdx + 1) % items.length;
      items[activeIdx]?.classList.add('active');
      items[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[activeIdx]?.classList.remove('active');
      activeIdx = (activeIdx - 1 + items.length) % items.length;
      items[activeIdx]?.classList.add('active');
      items[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIdx]?.click();
    } else if (e.key === 'Escape') {
      closeCommandPalette();
    }
  }

  function toggleCommandPalette() {
    commandPaletteActive = !commandPaletteActive;
    const el = document.getElementById('rr-command-palette');
    if (!el) return;
    el.classList.toggle('active', commandPaletteActive);
    if (commandPaletteActive) {
      const input = document.getElementById('rr-command-input');
      input.value = '';
      renderCommandResults('');
      setTimeout(() => input.focus(), 50);
    }
  }

  function closeCommandPalette() {
    commandPaletteActive = false;
    document.getElementById('rr-command-palette')?.classList.remove('active');
  }

  function refreshPostList() {
    allPosts = Array.from(document.querySelectorAll(
      'shreddit-post, [data-testid="post-container"], .Post, .thing.link, .link:not(.banner-link)'
    ));
  }

  function navigatePost(direction) {
    refreshPostList();
    if (!allPosts.length) return;

    let closestIndex = 0;
    let minDistance = Infinity;

    allPosts.forEach((post, i) => {
      const rect = post.getBoundingClientRect();
      const distance = Math.abs(rect.top);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    });

    let nextIndex = closestIndex + direction;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= allPosts.length) nextIndex = allPosts.length - 1;

    const nextPost = allPosts[nextIndex];
    if (!nextPost) return;

    const y = nextPost.getBoundingClientRect().top + window.pageYOffset - 60;
    window.scrollTo({ top: y, behavior: 'smooth' });

    allPosts.forEach(p => p.classList.remove('rr-highlight-post'));
    nextPost.classList.add('rr-highlight-post');
    currentPostIndex = nextIndex;
  }

  function openCurrentPost() {
    if (currentPostIndex < 0 || !allPosts[currentPostIndex]) return;
    const post = allPosts[currentPostIndex];
    const link = post.querySelector('a[data-testid="post-title"], a[href*="/comments/"], .title a, a[slot="title"]');
    if (link) {
      link.click();
    } else {
      post.click();
    }
  }

  function setupKeyboardNav() {
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, [contenteditable="true"]')) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      if (commandPaletteActive) return;

      if (!settings.keyboardNav) return;

      switch (e.key) {
        case 'j':
          e.preventDefault();
          navigatePost(1);
          break;
        case 'k':
          e.preventDefault();
          navigatePost(-1);
          break;
        case 'o':
        case 'Enter':
          if (currentPostIndex >= 0) {
            e.preventDefault();
            openCurrentPost();
          }
          break;
        case 'x':
          if (e.altKey) {
            e.preventDefault();
            expandCurrentImage();
          }
          break;
        case 'c':
          if (e.altKey) {
            e.preventDefault();
            settings.compactMode = !settings.compactMode;
            saveSettings();
            applySettingsToDOM();
            showToast(`Compact: ${settings.compactMode ? 'ON' : 'OFF'}`);
          }
          break;
        case 'w':
          if (e.altKey) {
            e.preventDefault();
            settings.wideMode = !settings.wideMode;
            saveSettings();
            applySettingsToDOM();
            showToast(`Wide: ${settings.wideMode ? 'ON' : 'OFF'}`);
          }
          break;
        case 'f':
          if (e.altKey) {
            e.preventDefault();
            settings.focusMode = !settings.focusMode;
            saveSettings();
            applySettingsToDOM();
            showToast(`Focus: ${settings.focusMode ? 'ON' : 'OFF'}`);
          }
          break;
        case 'a':
          voteCurrentPost('upvote');
          break;
        case 'z':
          voteCurrentPost('downvote');
          break;
      }
    });
  }

  function voteCurrentPost(type) {
    refreshPostList();
    if (!allPosts.length) return;

    let targetPost = null;
    if (currentPostIndex >= 0 && currentPostIndex < allPosts.length && allPosts[currentPostIndex].classList.contains('rr-highlight-post')) {
      targetPost = allPosts[currentPostIndex];
    } else {
      let minD = Infinity;
      allPosts.forEach(p => {
        const d = Math.abs(p.getBoundingClientRect().top);
        if (d < minD) { minD = d; targetPost = p; }
      });
    }

    if (!targetPost) return;

    const btn = targetPost.querySelector(`[aria-label="${type}"], button[data-click-id="${type}"]`);
    if (btn) {
      btn.click();
      return;
    }

    if (targetPost.shadowRoot) {
      const shadowBtns = targetPost.shadowRoot.querySelectorAll('button');
      if (shadowBtns) {
        for (let b of shadowBtns) {
          if (b.getAttribute(type) !== null) { b.click(); return; }
          if (b.getAttribute('button-type') === type) { b.click(); return; }
        }
      }
    }
  }

  function expandCurrentImage() {
    if (currentPostIndex < 0 || !allPosts[currentPostIndex]) return;
    const post = allPosts[currentPostIndex];
    const expander = post.querySelector('[data-testid="expand-button"], .expando-button');
    if (expander) expander.click();
  }

  function addReadingTimeToPost(post) {
    if (!settings.showReadingTime) return;
    if (post.querySelector('.rr-reading-time') || post.shadowRoot?.querySelector('.rr-reading-time')) return;

    let textContent = post.querySelector('.md, [data-testid="post-body"], .RichTextJSON-root, [slot="text-body"]');
    if (!textContent && post.shadowRoot) {
      textContent = post.shadowRoot.querySelector('.md, [slot="text-body"], .text-neutral-content');
    }
    if (!textContent) return;

    const text = textContent.textContent || '';
    const words = text.trim().split(/\s+/).length;
    if (words < 30) return;

    const minutes = Math.max(1, Math.round(words / 200));
    const badge = document.createElement('span');
    badge.className = 'rr-reading-time';
    badge.innerHTML = `📖 ${minutes} min read`;

    let meta = post.querySelector('.Post__metadata, .PostHeader__metadata, .tagline, [data-testid="post-timestamp"], [slot="credit-bar"]');

    if (post.tagName === 'SHREDDIT-POST') {
      const creditBar = post.querySelector('[slot="credit-bar"]');
      if (creditBar) { creditBar.appendChild(badge); }
      else { post.appendChild(badge); }
    } else if (meta) {
      meta.appendChild(badge);
    }
  }

  function collapseBotComments() {
    if (!settings.collapseBots) return;
    document.querySelectorAll('shreddit-comment[author="AutoModerator"], .comment[data-author="AutoModerator"]').forEach(comment => {
      if (!comment.dataset.rrCollapsed) {
        if (comment.tagName === 'SHREDDIT-COMMENT') {
          comment.setAttribute('collapsed', '');
        } else {
          comment.classList.add('collapsed');
        }
        comment.dataset.rrCollapsed = 'true';
      }
    });
  }

  function createUserTagPopup() {
    if (document.getElementById('rr-user-tag-popup')) return;

    const popup = document.createElement('div');
    popup.id = 'rr-user-tag-popup';

    const tagColors = ['#7c5cff', '#ff6b35', '#40c057', '#ffd43b', '#e64980', '#5c7cfa', '#20c997', '#ff8787'];

    popup.innerHTML = `
      <input type="text" id="rr-tag-input" placeholder="Tag this user..." />
      <div class="rr-tag-colors">
        ${tagColors.map(c => `<div class="rr-tag-color" data-color="${c}" style="background:${c}"></div>`).join('')}
      </div>
      <button class="rr-tag-btn" id="rr-tag-save">Save Tag</button>
    `;
    document.body.appendChild(popup);

    let selectedColor = tagColors[0];
    let targetUser = '';

    popup.querySelectorAll('.rr-tag-color').forEach(el => {
      el.addEventListener('click', () => {
        popup.querySelectorAll('.rr-tag-color').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        selectedColor = el.dataset.color;
      });
    });

    document.getElementById('rr-tag-save').addEventListener('click', () => {
      const tagText = document.getElementById('rr-tag-input').value.trim();
      if (tagText && targetUser) {
        settings.userTags[targetUser] = { text: tagText, color: selectedColor };
        saveSettings();
        applyUserTags();
        showToast(`Tagged ${targetUser}: ${tagText}`);
      }
      popup.classList.remove('active');
    });

    document.addEventListener('click', e => {
      if (!popup.contains(e.target) && !e.target.classList.contains('rr-tag-trigger')) {
        popup.classList.remove('active');
      }
    });

    window.rrOpenTagPopup = (username, anchorEl) => {
      targetUser = username;
      const rect = anchorEl.getBoundingClientRect();
      popup.style.top = (rect.bottom + 8) + 'px';
      popup.style.left = Math.min(rect.left, window.innerWidth - 280) + 'px';
      document.getElementById('rr-tag-input').value = settings.userTags[username]?.text || '';
      selectedColor = settings.userTags[username]?.color || tagColors[0];
      popup.querySelectorAll('.rr-tag-color').forEach(c => {
        c.classList.toggle('selected', c.dataset.color === selectedColor);
      });
      popup.classList.add('active');
      document.getElementById('rr-tag-input').focus();
    };
  }

  function applyUserTags() {
    document.querySelectorAll('.rr-user-tag').forEach(t => t.remove());

    const userLinks = document.querySelectorAll('a[href*="/user/"], a[href*="/u/"]');
    userLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/u(?:ser)?\/([^/?\s]+)/);
      if (!match) return;
      const username = match[1];
      const tag = settings.userTags[username];

      if (!link.nextElementSibling?.classList.contains('rr-tag-trigger')) {
        const trigger = document.createElement('span');
        trigger.className = 'rr-tag-trigger';
        trigger.textContent = '🏷️';
        trigger.style.cssText = 'cursor:pointer;font-size:11px;margin-left:4px;opacity:0.4;transition:opacity 0.2s';
        trigger.addEventListener('mouseenter', () => trigger.style.opacity = '1');
        trigger.addEventListener('mouseleave', () => trigger.style.opacity = '0.4');
        trigger.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          window.rrOpenTagPopup(username, trigger);
        });
        link.parentNode.insertBefore(trigger, link.nextSibling);
      }

      if (tag) {
        const existing = link.parentNode.querySelector('.rr-user-tag');
        if (existing) existing.remove();
        const badge = document.createElement('span');
        badge.className = 'rr-user-tag';
        badge.textContent = tag.text;
        badge.style.background = tag.color + '22';
        badge.style.color = tag.color;
        badge.style.border = `1px solid ${tag.color}44`;
        const afterTrigger = link.nextElementSibling;
        if (afterTrigger) {
          afterTrigger.parentNode.insertBefore(badge, afterTrigger.nextSibling);
        }
      }
    });
  }

  function injectShadowStyles() {
    const isLight = document.documentElement.classList.contains('theme-light') ||
      document.documentElement.getAttribute('data-theme') === 'light' ||
      document.body.classList.contains('theme-light');

    const bgP = isLight ? '#ffffff' : 'var(--rr-bg-primary, #08080e)';
    const bgS = isLight ? '#f3f4f6' : 'var(--rr-bg-secondary, #0e0e18)';
    const bgT = isLight ? '#e5e7eb' : 'var(--rr-bg-tertiary, #141422)';
    const txP = isLight ? '#111827' : 'var(--rr-text-primary, #e4e4f0)';
    const txS = isLight ? '#4b5563' : 'var(--rr-text-secondary, #9494b8)';
    const txF = isLight ? '#000000' : '#ffffff';

    const shadowed = document.querySelectorAll('shreddit-post, shreddit-comment, shreddit-app, faceplate-tabpanel, faceplate-batch, reddit-header-large, reddit-header-action-items');
    shadowed.forEach(el => {
      if (!el.shadowRoot) return;

      const existing = el.shadowRoot.querySelector('.rr-injected-style');
      if (existing) existing.remove();

      const style = document.createElement('style');
      style.className = 'rr-injected-style';
      style.textContent = `
        :host {
          --color-neutral-background: ${bgP} !important;
          --color-neutral-background-weak: ${bgS} !important;
          --color-neutral-background-strong: ${bgT} !important;
          --color-neutral-content: ${txP} !important;
          --color-neutral-content-weak: ${txS} !important;
          --color-neutral-content-strong: ${txF} !important;
          --color-secondary-background: ${bgS} !important;
          --color-primary: var(--rr-accent, #10b981) !important;
          --color-primary-background: var(--rr-accent, #10b981) !important;
          --color-upvote: var(--rr-upvote, #ff6b35) !important;
          --color-downvote: var(--rr-downvote, #059669) !important;
          font-family: ${settings.undertaleTheme ? "'VT323', monospace" : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"} !important;
        }
        * {
          font-family: inherit !important;
        }
        a { color: var(--rr-accent, #10b981) !important; }
        a:hover { color: var(--rr-accent-hover, #059669) !important; }
        ${settings.undertaleTheme ? `
          * { background: transparent !important; color: #fff !important; }
          :host { background: #000 !important; }
          button, [role="button"] { 
            border: 2px solid #fff !important; 
            background: #000 !important; 
            color: #fca5a5 !important; 
            text-transform: uppercase !important; 
            border-radius: 0 !important; 
          }
          button:hover, [role="button"]:hover {
            background: #fff !important; color: #000 !important;
          }
          button[upvote] svg, button[downvote] svg { display: none !important; }
          button[upvote]::before { content: '❤️'; font-size: 16px; margin: auto; }
          button[downvote]::before { content: '🖤'; font-size: 16px; margin: auto; }
        ` : ''}
      `;
      el.shadowRoot.prepend(style);
    });
  }

  function observeDOM() {
    const observer = new MutationObserver(mutations => {
      let needsAdRemoval = false;
      let needsShadowInjection = false;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          if (node.matches?.('shreddit-post, shreddit-comment, shreddit-app') || node.querySelector?.('shreddit-post, shreddit-comment')) {
            needsShadowInjection = true;
          }

          if (settings.removeAds && (
            node.matches?.('[data-promoted], .promoted, [data-ad-type], shreddit-ad-post') ||
            node.querySelector?.('[data-promoted], .promoted, [data-ad-type], shreddit-ad-post')
          )) {
            needsAdRemoval = true;
          }

          if (node.matches?.('[data-testid="post-container"], .Post, .thing.link, shreddit-post')) {
            addReadingTimeToPost(node);
          }
          if (settings.collapseBots && node.matches?.('shreddit-comment[author="AutoModerator"], .comment[data-author="AutoModerator"]')) {
            collapseBotComments();
          }
        }
      }

      if (needsAdRemoval) removeAds();
      if (needsShadowInjection) injectShadowStyles();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function addMediaDownloadButtons() {
    document.addEventListener('mouseover', e => {
      const mediaContainer = e.target.closest('shreddit-post [slot="post-media-container"], [data-testid="post-media-container"], .media-preview-content');
      if (!mediaContainer) return;
      if (mediaContainer.querySelector('.rr-download-btn') || mediaContainer.shadowRoot?.querySelector('.rr-download-btn')) return;

      const downloadBtn = document.createElement('a');
      downloadBtn.className = 'rr-download-btn';
      downloadBtn.innerHTML = '⬇️';
      downloadBtn.title = 'Download Media';
      downloadBtn.style.cssText = 'position:absolute;top:12px;right:12px;background:var(--rr-bg-elevated);border:1px solid var(--rr-border);color:var(--rr-text-primary);border-radius:50%;width:36px;height:36px;cursor:pointer;z-index:99999;font-size:18px;text-decoration:none;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:0.8;transition:opacity 0.2s;';
      downloadBtn.onmouseenter = () => downloadBtn.style.opacity = '1';
      downloadBtn.onmouseleave = () => downloadBtn.style.opacity = '0.8';

      let url = '';
      const img = mediaContainer.querySelector('img[src]');
      const video = mediaContainer.querySelector('video source[src], video[src]');
      if (img && !img.src.includes('redditmedia.com/avatars')) url = img.src;
      if (video) url = video.src;

      if (!url && mediaContainer.shadowRoot) {
        const shadowImg = mediaContainer.shadowRoot.querySelector('img[src]');
        if (shadowImg) url = shadowImg.src;
      }

      if (!url) return;

      downloadBtn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reddit_media';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      if (getComputedStyle(mediaContainer).position === 'static') {
        mediaContainer.style.position = 'relative';
      }

      mediaContainer.appendChild(downloadBtn);
    });
  }

  function processExistingPosts() {
    document.querySelectorAll('[data-testid="post-container"], .Post, .thing.link, shreddit-post').forEach(post => {
      addReadingTimeToPost(post);
    });
  }

  function addQuickSubredditBar() {
    if (document.getElementById('rr-quick-subs')) return;

    const bar = document.createElement('div');
    bar.id = 'rr-quick-subs';
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:999999;display:flex;gap:6px;padding:8px 12px;overflow-x:auto;background:var(--rr-bg-elevated);border:1px solid var(--rr-border);border-radius:30px;box-shadow:0 10px 30px rgba(0,0,0,0.5);flex-wrap:nowrap;backdrop-filter:blur(10px);max-width:90vw;scrollbar-width:none;align-items:center;';

    const renderItems = () => {
      bar.innerHTML = '';
      const favSubs = JSON.parse(localStorage.getItem('rr-fav-subs') || '[]');
      if (!favSubs.length) {
        const defaults = ['technology', 'programming', 'gaming', 'science', 'worldnews', 'askreddit', 'funny'];
        favSubs.push(...defaults);
        localStorage.setItem('rr-fav-subs', JSON.stringify(favSubs));
      }

      const homeWrapper = document.createElement('div');
      homeWrapper.style.cssText = 'display:flex;align-items:center;background:var(--rr-bg-primary);border-radius:20px;padding:4px 10px;gap:6px;border:1px solid var(--rr-border-hover);';
      const homeLink = document.createElement('a');
      homeLink.href = 'https://www.reddit.com/';
      homeLink.innerHTML = '🏠 Home';
      homeLink.style.cssText = 'color:var(--rr-text-primary);text-decoration:none;font-weight:600;font-size:12px;white-space:nowrap;';
      homeWrapper.appendChild(homeLink);
      bar.appendChild(homeWrapper);

      favSubs.forEach(sub => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;align-items:center;background:var(--rr-bg-primary);border-radius:20px;padding:4px 10px;gap:6px;border:1px solid var(--rr-border-hover);';

        const a = document.createElement('a');
        a.href = `https://www.reddit.com/r/${sub}/`;
        a.textContent = `r/${sub}`;
        a.style.cssText = 'color:var(--rr-text-primary);text-decoration:none;font-weight:600;font-size:12px;white-space:nowrap;';

        const rm = document.createElement('span');
        rm.innerHTML = '&times;';
        rm.title = "Remove";
        rm.style.cssText = 'cursor:pointer;color:var(--rr-text-muted);font-size:16px;line-height:1;margin-top:-2px;transition:color 0.2s;';
        rm.onmouseenter = () => rm.style.color = 'var(--rr-upvote)';
        rm.onmouseleave = () => rm.style.color = 'var(--rr-text-muted)';
        rm.onclick = () => {
          const updated = JSON.parse(localStorage.getItem('rr-fav-subs') || '[]').filter(s => s !== sub);
          localStorage.setItem('rr-fav-subs', JSON.stringify(updated));
          renderItems();
          showToast(`Removed r/${sub}`);
        };

        wrapper.appendChild(a);
        wrapper.appendChild(rm);
        bar.appendChild(wrapper);
      });

      const addBtn = document.createElement('div');
      addBtn.textContent = '+ Add';
      addBtn.style.cssText = 'cursor:pointer;font-weight:600;font-size:12px;padding:6px 12px;border-radius:20px;background:var(--rr-accent);color:#fff;white-space:nowrap;';
      addBtn.onclick = () => {
        const sub = prompt('Enter subreddit name (without r/):');
        if (sub && sub.trim()) {
          const cleanedArgs = sub.trim().replace(/^r\//, '');
          const current = JSON.parse(localStorage.getItem('rr-fav-subs') || '[]');
          if (!current.includes(cleanedArgs)) {
            current.push(cleanedArgs);
            localStorage.setItem('rr-fav-subs', JSON.stringify(current));
            renderItems();
          }
        }
      };
      bar.appendChild(addBtn);

      const toggleBtn = document.createElement('div');
      let isBottom = localStorage.getItem('rr-dock-pos') !== 'top';

      const updatePos = () => {
        if (isBottom) {
          bar.style.bottom = '24px';
          bar.style.top = 'auto';
          toggleBtn.innerHTML = '↑';
        } else {
          bar.style.top = '24px';
          bar.style.bottom = 'auto';
          toggleBtn.innerHTML = '↓';
        }
      };

      toggleBtn.style.cssText = 'cursor:pointer;font-weight:600;font-size:16px;padding:2px 8px;border-radius:20px;background:transparent;color:var(--rr-text-muted);user-select:none;margin-left:auto;text-align:right;';
      toggleBtn.title = "Move Dock";
      toggleBtn.onclick = () => {
        isBottom = !isBottom;
        localStorage.setItem('rr-dock-pos', isBottom ? 'bottom' : 'top');
        updatePos();
      };

      bar.appendChild(toggleBtn);
      updatePos();
    };

    renderItems();
    document.body.appendChild(bar);
  }

  function addPostPreviewOnHover() {
    let previewEl = null;
    let hoverTimeout = null;

    document.addEventListener('mouseover', e => {
      const link = e.target.closest('a[data-testid="post-title"], .title a');
      if (!link) return;

      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        const post = link.closest('[data-testid="post-container"], .Post, .thing.link, shreddit-post');
        if (!post) return;

        const selftext = post.querySelector('.md, [data-testid="post-body"], .RichTextJSON-root');
        if (!selftext || !selftext.textContent.trim()) return;

        if (previewEl) previewEl.remove();

        previewEl = document.createElement('div');
        previewEl.style.cssText = `
          position:fixed;z-index:99997;max-width:500px;max-height:300px;overflow-y:auto;
          background:var(--rr-bg-elevated);border:1px solid var(--rr-border);border-radius:var(--rr-radius);
          padding:16px;box-shadow:var(--rr-shadow);font-size:13px;line-height:1.6;
          color:var(--rr-text-primary);pointer-events:none;
        `;
        previewEl.textContent = selftext.textContent.slice(0, 600) + (selftext.textContent.length > 600 ? '...' : '');

        const rect = link.getBoundingClientRect();
        previewEl.style.top = (rect.bottom + 8) + 'px';
        previewEl.style.left = Math.min(rect.left, window.innerWidth - 520) + 'px';
        document.body.appendChild(previewEl);
      }, 500);
    });

    document.addEventListener('mouseout', e => {
      const link = e.target.closest('a[data-testid="post-title"], .title a');
      if (link) {
        clearTimeout(hoverTimeout);
        if (previewEl) {
          previewEl.remove();
          previewEl = null;
        }
      }
    });
  }

  function addCommentNavigation() {
    if (!window.location.pathname.includes('/comments/')) return;
    if (document.getElementById('rr-comment-nav')) return;

    const nav = document.createElement('div');
    nav.id = 'rr-comment-nav';
    nav.style.cssText = `
      position:fixed;right:28px;top:50%;transform:translateY(-50%);z-index:99997;
      display:flex;flex-direction:column;gap:6px;
    `;

    const btnStyle = `
      width:36px;height:36px;background:var(--rr-bg-elevated);border:1px solid var(--rr-border);
      border-radius:50%;color:var(--rr-text-secondary);font-size:14px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;transition:all 0.2s;
    `;

    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '▲';
    prevBtn.title = 'Previous top-level comment';
    prevBtn.style.cssText = btnStyle;

    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '▼';
    nextBtn.title = 'Next top-level comment';
    nextBtn.style.cssText = btnStyle;

    let commentIdx = -1;

    function getTopComments() {
      return Array.from(document.querySelectorAll(
        '.comment.depth-0, [data-testid="comment-top-meta"]:not(.child .comment), shreddit-comment[depth="0"]'
      ));
    }

    prevBtn.addEventListener('click', () => {
      const comments = getTopComments();
      commentIdx = Math.max(0, commentIdx - 1);
      comments[commentIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    nextBtn.addEventListener('click', () => {
      const comments = getTopComments();
      commentIdx = Math.min(comments.length - 1, commentIdx + 1);
      comments[commentIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    [prevBtn, nextBtn].forEach(b => {
      b.addEventListener('mouseenter', () => { b.style.background = 'var(--rr-accent)'; b.style.color = '#fff'; });
      b.addEventListener('mouseleave', () => { b.style.background = 'var(--rr-bg-elevated)'; b.style.color = 'var(--rr-text-secondary)'; });
    });

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    document.body.appendChild(nav);
  }

  function addPostAge() {
    document.querySelectorAll('time[datetime]').forEach(timeEl => {
      if (timeEl.dataset.rrProcessed) return;
      timeEl.dataset.rrProcessed = 'true';

      const date = new Date(timeEl.getAttribute('datetime'));
      const now = new Date();
      const diff = now - date;
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      let color = 'var(--rr-online)';
      if (hours > 24) color = 'var(--rr-text-muted)';
      else if (hours > 6) color = 'var(--rr-gold)';
      else if (hours > 1) color = 'var(--rr-accent)';

      timeEl.style.color = color;
    });
  }

  async function init() {
    await loadSettings();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
  }

  function onReady() {
    applySettingsToDOM();
    createReadingProgressBar();
    createScrollTopButton();
    createFAB();
    createToastContainer();
    createCommandPalette();
    createUserTagPopup();
    addQuickSubredditBar();
    createFloatingHeaderMenu();
    addPostPreviewOnHover();
    addCommentNavigation();
    processExistingPosts();
    applyUserTags();
    addPostAge();
    injectShadowStyles();
    setupKeyboardNav();
    observeDOM();
    collapseBotComments();

    setInterval(() => {
      injectShadowStyles();
      applyUserTags();
      addPostAge();
      collapseBotComments();
    }, 3000);

    showToast('Reddit Restyled ✨ — Ctrl+K for commands');
  }

  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg.action === 'settingsUpdated') {
      loadSettings().then(() => applySettingsToDOM());
    }
  });

  init();
})();
