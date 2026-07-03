document.addEventListener('DOMContentLoaded', async () => {
  const inputText = document.getElementById('popupInputText');
  const targetLang = document.getElementById('popupTargetLang');
  const translateBtn = document.getElementById('translateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const resultArea = document.getElementById('popupResult');
  const resultText = document.getElementById('popupResultText');
  const statusEl = document.getElementById('popupStatus');
  const copyBtn = document.getElementById('popupCopyBtn');
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

  async function doTranslate() {
    const text = inputText.value.trim();
    if (!text) {
      showStatus('\u8bf7\u8f93\u5165\u8981\u7ffb\u8bd1\u7684\u6587\u672c', 'warn');
      return;
    }
    if (text.length > 10000) {
      showStatus('\u6587\u672c\u8fc7\u957f\uff0c\u8bf7\u9650\u5236\u5728 10000 \u5b57\u7b26\u4ee5\u5185', 'error');
      return;
    }

    resultArea.style.display = 'block';
    const resultHeader = resultArea.querySelector('.popup-result-header span');
    resultHeader.textContent = '\u7ffb\u8bd1\u4e2d...';
    resultText.textContent = '';
    copyBtn.style.display = 'none';
    statusEl.className = 'popup-status';
    statusEl.textContent = '';
    translateBtn.disabled = true;
    translateBtn.textContent = '\u7ffb\u8bd1\u4e2d...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        targetLang: targetLang.value
      });
      if (response?.success) {
        resultText.textContent = response.translation;
        resultHeader.textContent = '\u7ffb\u8bd1\u7ed3\u679c';
        copyBtn.style.display = '';
      } else {
        const errMsg = response?.error || '\u7ffb\u8bd1\u5931\u8d25';
        resultText.innerHTML = '<span class="error-text">\u274c ' + escapeHtml(errMsg) + '</span>';
        resultHeader.textContent = '\u7ffb\u8bd1\u5931\u8d25';
        copyBtn.style.display = 'none';
      }
    } catch (err) {
      resultText.innerHTML = '<span class="error-text">\u274c ' + escapeHtml(err.message) + '</span>';
      resultHeader.textContent = '\u7ffb\u8bd1\u5931\u8d25';
      copyBtn.style.display = 'none';
    } finally {
      translateBtn.disabled = false;
      translateBtn.textContent = '\u7ffb\u8bd1';
    }
  }

  function showStatus(msg, type) {
    statusEl.className = 'popup-status popup-status-' + (type || 'info');
    statusEl.textContent = msg;
    setTimeout(() => { statusEl.className = 'popup-status'; }, 3000);
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
        showStatus('\u5df2\u590d\u5236', 'success');
      } catch { showStatus('\u590d\u5236\u5931\u8d25', 'error'); }
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
