const DEFAULT_CONFIG = {
  apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
  apiKey: '',
  model: '',
  targetLang: 'zh-CN',
  fontSize: 14,
  theme: 'auto'
};

document.addEventListener('DOMContentLoaded', async () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const modelInput = document.getElementById('model');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const testBtn = document.getElementById('testBtn');
  const saveStatus = document.getElementById('saveStatus');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const navItems = document.querySelectorAll('.nav-item');
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  const fontSizeInput = document.getElementById('fontSize');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const hintChips = document.querySelectorAll('.hint-chip');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById(item.dataset.tab).classList.add('active');
    });
  });

  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
  });

  hintChips.forEach(chip => {
    chip.addEventListener('click', () => {
      modelInput.value = chip.dataset.model;
    });
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      apiUrlInput.value = btn.dataset.url;
    });
  });

  themeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      radio.closest('.theme-card').classList.add('active');
    });
  });

  fontSizeInput.addEventListener('input', () => {
    fontSizeValue.textContent = fontSizeInput.value + 'px';
  });

  async function loadConfig() {
    try {
      const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
      const config = { ...DEFAULT_CONFIG };
      for (const key of Object.keys(DEFAULT_CONFIG)) {
        if (stored[key] !== undefined) config[key] = stored[key];
      }
      apiUrlInput.value = config.apiUrl;
      apiKeyInput.value = config.apiKey;
      modelInput.value = config.model;
      fontSizeInput.value = config.fontSize;
      fontSizeValue.textContent = config.fontSize + 'px';
      const theme = ['auto', 'light', 'dark'].includes(config.theme) ? config.theme : 'auto';
      const themeRadio = document.querySelector('input[name="theme"][value="' + theme + '"]');
      if (themeRadio) themeRadio.checked = true;
      presetBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.url === config.apiUrl);
      });
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }

  async function saveConfig() {
    const apiUrl = apiUrlInput.value.trim();
    if (!apiUrl) {
      showStatus('\u8bf7\u8f93\u5165 API URL', 'error');
      return;
    }
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      showStatus('API URL \u5fc5\u987b\u4ee5 http:// \u6216 https:// \u5f00\u5934', 'error');
      return;
    }

    const selectedTheme = document.querySelector('input[name="theme"]:checked');
    const config = {
      apiUrl: apiUrl,
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim(),
      targetLang: 'zh-CN',
      theme: selectedTheme ? selectedTheme.value : 'auto',
      fontSize: parseInt(fontSizeInput.value, 10) || 14
    };

    try {
      await chrome.storage.sync.set(config);
      showStatus('\u914d\u7f6e\u5df2\u4fdd\u5b58', 'success');
    } catch (err) {
      showStatus('\u4fdd\u5b58\u5931\u8d25: ' + err.message, 'error');
    }
  }

  async function testConnection() {
    const apiUrl = apiUrlInput.value.trim();
    if (!apiUrl) { showStatus('\u8bf7\u5148\u8f93\u5165 API URL', 'error'); return; }

    testBtn.disabled = true;
    testBtn.textContent = '\u6d4b\u8bd5\u4e2d...';
    showStatus('\u6b63\u5728\u6d4b\u8bd5\u8fde\u63a5...', 'info');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'testConnection',
        apiUrl: apiUrl,
        apiKey: apiKeyInput.value.trim(),
        model: modelInput.value.trim()
      });
      if (response?.success) {
        showStatus('\u2705 ' + response.message, 'success');
      } else {
        showStatus('\u274c ' + (response?.error || '\u8fde\u63a5\u5931\u8d25'), 'error');
      }
    } catch (err) {
      showStatus('\u274c ' + err.message, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> \u6d4b\u8bd5\u8fde\u63a5';
    }
  }

  async function resetConfig() {
    try {
      await chrome.storage.sync.set(DEFAULT_CONFIG);
      await loadConfig();
      showStatus('\u5df2\u6062\u590d\u9ed8\u8ba4\u8bbe\u7f6e', 'success');
    } catch (err) {
      showStatus('\u6062\u590d\u5931\u8d25: ' + err.message, 'error');
    }
  }

  let statusTimeout;

  function showStatus(msg, type) {
    if (statusTimeout) clearTimeout(statusTimeout);
    const validTypes = ['error', 'success', 'info'];
    const typeClass = validTypes.includes(type) ? ' save-status-' + type : '';
    saveStatus.className = 'save-status' + typeClass;
    saveStatus.textContent = msg;
    statusTimeout = setTimeout(() => {
      saveStatus.className = 'save-status';
      saveStatus.textContent = '';
    }, 3000);
  }

  testBtn.addEventListener('click', testConnection);
  saveBtn.addEventListener('click', saveConfig);
  resetBtn.addEventListener('click', resetConfig);

  await loadConfig();
});
