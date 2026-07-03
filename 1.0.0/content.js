(function () {
  'use strict';

  let translatePopup = null;
  let translateIcon = null;
  let selectedText = '';
  let isPopupVisible = false;
  let iconHideTimeout = null;

  const DEFAULT_CONFIG = {
    targetLang: 'zh-CN',
    fontSize: 14,
    theme: 'auto'
  };
  let config = { ...DEFAULT_CONFIG };

  loadConfig();

  chrome.storage.onChanged.addListener((changes) => {
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      if (changes[key] !== undefined) config[key] = changes[key].newValue;
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translateSelection') {
      showTranslatePopup(message.text);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Unknown action' });
    }
  });

  async function loadConfig() {
    try {
      const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
      for (const key of Object.keys(DEFAULT_CONFIG)) {
        if (stored[key] !== undefined) config[key] = stored[key];
      }
    } catch (e) {
      console.warn('[AI Translate] Failed to load config:', e);
    }
  }

  document.addEventListener('mouseup', (event) => {
    if (iconHideTimeout) {
      clearTimeout(iconHideTimeout);
      iconHideTimeout = null;
    }
    if (translatePopup && translatePopup.contains(event.target)) return;
    if (translateIcon && translateIcon.contains(event.target)) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';

    if (text && text.length > 0 && text.length <= 5000 && selection && selection.rangeCount > 0) {
      selectedText = text;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showTranslateIcon(rect);
    } else {
      if (isPopupVisible && translatePopup && !translatePopup.contains(event.target)) {
        iconHideTimeout = setTimeout(() => {
          hideTranslatePopup();
          hideTranslateIcon();
        }, 300);
      } else if (!isPopupVisible) {
        hideTranslateIcon();
      }
    }
  });

  document.addEventListener('scroll', () => {
    if (isPopupVisible) {
      hideTranslatePopup();
      hideTranslateIcon();
    } else {
      hideTranslateIcon();
    }
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isPopupVisible) {
      hideTranslatePopup();
      hideTranslateIcon();
    }
  });

  function showTranslateIcon(rect) {
    if (!translateIcon) {
      translateIcon = document.createElement('div');
      translateIcon.id = 'ai-translate-icon';
      translateIcon.insertAdjacentHTML('afterbegin', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>');
      translateIcon.title = chrome.i18n.getMessage('translateThis') || '\u7ffb\u8bd1\u6b64\u6587\u672c';
      translateIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        showTranslatePopup(selectedText);
        hideTranslateIcon();
      });
      document.body.appendChild(translateIcon);
    }

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let left = rect.right + scrollX + 4;
    let top = rect.top + scrollY - 36 - 4;

    if (top < scrollY + 4) top = rect.bottom + scrollY + 4;
    if (left + 36 > window.innerWidth + scrollX - 4) left = rect.left + scrollX - 36 - 4;
    if (left < scrollX + 4) {
      left = rect.right + scrollX + 4;
      top = rect.bottom + scrollY + 4;
    }

    translateIcon.style.left = left + 'px';
    translateIcon.style.top = top + 'px';
    translateIcon.style.display = 'flex';
  }

  function hideTranslateIcon() {
    if (translateIcon) translateIcon.style.display = 'none';
  }

  async function showTranslatePopup(text) {
    if (!text) text = selectedText;
    if (!text || !text.trim()) return;

    if (translatePopup) {
      translatePopup.remove();
      translatePopup = null;
    }
    isPopupVisible = false;

    translatePopup = document.createElement('div');
    translatePopup.id = 'ai-translate-popup';
    translatePopup.style.setProperty('--popup-font-size', config.fontSize + 'px');
    applyTheme(translatePopup);

    const header = document.createElement('div');
    header.className = 'popup-header';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'popup-title';
    titleSpan.textContent = chrome.i18n.getMessage('translating') || '\u7ffb\u8bd1\u4e2d...';
    header.appendChild(titleSpan);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'popup-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = chrome.i18n.getMessage('close') || '\u5173\u95ed';
    closeBtn.addEventListener('click', () => hideTranslatePopup());
    header.appendChild(closeBtn);
    translatePopup.appendChild(header);

    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'popup-source';
    sourceDiv.textContent = text.length > 200 ? text.substring(0, 200) + '...' : text;
    translatePopup.appendChild(sourceDiv);

    const divider = document.createElement('div');
    divider.className = 'popup-divider';
    translatePopup.appendChild(divider);

    const resultDiv = document.createElement('div');
    resultDiv.className = 'popup-result';
    resultDiv.innerHTML = '<div class="popup-loading"><div class="spinner"></div><span>' + (chrome.i18n.getMessage('translating') || '\u7ffb\u8bd1\u4e2d...') + '</span></div>';
    translatePopup.appendChild(resultDiv);

    const actions = document.createElement('div');
    actions.className = 'popup-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'popup-btn';
    copyBtn.textContent = chrome.i18n.getMessage('copy') || '\u590d\u5236';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const resultContent = resultDiv.querySelector('.popup-result-text')?.textContent || '';
      if (resultContent) {
        try {
          await navigator.clipboard.writeText(resultContent);
          copyBtn.textContent = chrome.i18n.getMessage('copied') || '\u5df2\u590d\u5236';
          setTimeout(() => { copyBtn.textContent = chrome.i18n.getMessage('copy') || '\u590d\u5236'; }, 2000);
        } catch (err) { console.warn('[AI Translate] Copy failed:', err); }
      }
    });
    actions.appendChild(copyBtn);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'popup-btn';
    retryBtn.textContent = chrome.i18n.getMessage('retry') || '\u91cd\u8bd5';
    retryBtn.style.display = 'none';
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const headerTitle = translatePopup?.querySelector('.popup-title');
      if (headerTitle) headerTitle.textContent = chrome.i18n.getMessage('translating') || '\u7ffb\u8bd1\u4e2d...';
      resultDiv.innerHTML = '<div class="popup-loading"><div class="spinner"></div><span>' + (chrome.i18n.getMessage('translating') || '\u7ffb\u8bd1\u4e2d...') + '</span></div>';
      retryBtn.style.display = 'none';
      doTranslate(text, resultDiv, header.querySelector('.popup-title'), retryBtn);
    });
    actions.appendChild(retryBtn);
    translatePopup.appendChild(actions);

    positionPopup(translatePopup);
    document.body.appendChild(translatePopup);
    isPopupVisible = true;

    doTranslate(text, resultDiv, header.querySelector('.popup-title'), retryBtn);
  }

  async function doTranslate(text, resultDiv, titleEl, retryBtn) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        targetLang: config.targetLang
      });
      if (response && response.success) {
        resultDiv.innerHTML = '<div class="popup-result-text">' + escapeHtml(response.translation) + '</div>';
        if (titleEl) titleEl.textContent = chrome.i18n.getMessage('quickTranslate') || '\u7ffb\u8bd1\u7ed3\u679c';
      } else {
        const errMsg = response?.error || chrome.i18n.getMessage('translationFailed') || '\u7ffb\u8bd1\u5931\u8d25';
        resultDiv.innerHTML = '<div class="popup-error">\u274c ' + escapeHtml(errMsg) + '</div>';
        if (retryBtn) retryBtn.style.display = '';
      }
    } catch (error) {
      resultDiv.innerHTML = '<div class="popup-error">\u274c ' + escapeHtml(error.message) + '</div>';
      if (retryBtn) retryBtn.style.display = '';
    }
  }

  function positionPopup(popup) {
    popup.style.visibility = 'hidden';
    popup.style.position = 'fixed';
    popup.style.left = '0px';
    popup.style.top = '0px';
    document.body.appendChild(popup);

    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const selection = window.getSelection();
    let anchorRect;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      anchorRect = range.getBoundingClientRect();
    }
    if (!anchorRect || (anchorRect.top === 0 && anchorRect.left === 0)) {
      anchorRect = { top: viewportHeight / 3, bottom: viewportHeight / 3, left: viewportWidth / 2, right: viewportWidth / 2, width: 0, height: 0 };
    }

    let top = anchorRect.bottom + 8;
    let left = anchorRect.left;

    if (left + popupRect.width > viewportWidth - 10) left = Math.max(10, viewportWidth - popupRect.width - 10);
    if (left < 10) left = 10;
    if (top + popupRect.height > viewportHeight - 10) {
      top = anchorRect.top - popupRect.height - 8;
      if (top < 10) { top = 40; popup.style.maxHeight = (viewportHeight - 80) + 'px'; }
    }

    popup.style.position = 'fixed';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.style.visibility = 'visible';
  }

  function hideTranslatePopup() {
    if (translatePopup) { translatePopup.remove(); translatePopup = null; }
    isPopupVisible = false;
  }

  function applyTheme(popup) {
    let isDark = false;
    if (config.theme === 'dark') isDark = true;
    else if (config.theme === 'light') isDark = false;
    else isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    popup.classList.add(isDark ? 'theme-dark' : 'theme-light');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
