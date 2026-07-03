document.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  const inputText = document.getElementById('popupInputText');
  const targetLang = document.getElementById('popupTargetLang');
  const translateBtn = document.getElementById('translateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const resultArea = document.getElementById('popupResult');
  const resultText = document.getElementById('popupResultText');
  const statusEl = document.getElementById('popupStatus');
  const copyBtn = document.getElementById('popupCopyBtn');
  const saveBtn = document.getElementById('popupSaveBtn');
  const settingsBtn = document.getElementById('openSettings');

  async function loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      if (response?.success && response.config?.targetLang) {
        targetLang.value = response.config.targetLang;
      }
    } catch (err) { console.warn('[Popup] Load config failed:', err); }
  }

  async function saveTargetLang(lang) {
    await chrome.storage.sync.set({ targetLang: lang });
  }

  function t(key) { return chrome.i18n.getMessage(key) || key; }

  async function doTranslate() {
    const text = inputText.value.trim();
    if (!text) {
      showStatus(t('noTextToTranslate'), 'warn');
      return;
    }
    if (text.length > 10000) {
      showStatus(t('textTooLong'), 'error');
      return;
    }

    resultArea.style.display = 'block';
    const resultHeader = resultArea.querySelector('.popup-result-header span');
    resultHeader.textContent = t('translating');
    resultText.textContent = '';
    copyBtn.style.display = 'none';
    saveBtn.style.display = 'none';
    statusEl.className = 'popup-status';
    statusEl.textContent = '';
    translateBtn.disabled = true;
    translateBtn.textContent = t('translatingBtn');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        targetLang: targetLang.value
      });
      if (response?.success) {
        resultText.textContent = response.translation;
        resultHeader.textContent = t('translateResult');
        copyBtn.style.display = '';
        saveBtn.style.display = '';
      } else {
        const errMsg = response?.error || t('translationFailed');
        resultText.innerHTML = '<span class="error-text">\u274c ' + escapeHtml(errMsg) + '</span>';
        resultHeader.textContent = t('translationFailed');
        copyBtn.style.display = 'none';
        saveBtn.style.display = 'none';
      }
    } catch (err) {
      resultText.innerHTML = '<span class="error-text">\u274c ' + escapeHtml(err.message) + '</span>';
      resultHeader.textContent = t('translationFailed');
      copyBtn.style.display = 'none';
      saveBtn.style.display = 'none';
    } finally {
      translateBtn.disabled = false;
      translateBtn.textContent = t('translate');
    }
  }

  let statusTimeout;
  function showStatus(msg, type) {
    if (statusTimeout) clearTimeout(statusTimeout);
    statusEl.className = 'popup-status popup-status-' + (type || 'info');
    statusEl.textContent = msg;
    statusTimeout = setTimeout(() => { statusEl.className = 'popup-status'; }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  copyBtn.addEventListener('click', async () => {
    const text = resultText.textContent;
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        showStatus(t('copied'), 'success');
      } catch { showStatus(t('copyFailed'), 'error'); }
    }
  });

  saveBtn.addEventListener('click', async () => {
    const word = inputText.value.trim();
    const translation = resultText.textContent;
    if (word && translation && !translation.startsWith('\u274c')) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'addWord',
          entry: { word: word, translation: translation, targetLang: targetLang.value }
        });
        if (response?.success) {
          showStatus(t('saveSuccess'), 'success');
        }
      } catch (err) {
        showStatus(t('saveFailed'), 'error');
      }
    }
  });

  translateBtn.addEventListener('click', doTranslate);
  clearBtn.addEventListener('click', () => {
    inputText.value = '';
    resultArea.style.display = 'none';
    statusEl.className = 'popup-status';
    statusEl.textContent = '';
    inputText.focus();
  });
  targetLang.addEventListener('change', () => saveTargetLang(targetLang.value));
  settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  inputText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doTranslate(); }
  });
  inputText.focus();
  await loadConfig();
});
