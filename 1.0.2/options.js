const DEFAULT_CONFIG = {
  apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
  apiKey: '',
  model: '',
  targetLang: 'zh-CN',
  fontSize: 14,
  theme: 'auto',
  customPrompt: '',
  autoTranslate: false
};

const STYLE_PRESETS = {
  standard: '你是一个专业的翻译助手。请将用户提供的文本翻译成{targetLang}。直接返回翻译结果，不要包含任何解释、说明或额外内容。保持原文的格式（包括换行、标点符号）。如果原文已包含{targetLang}，直接返回原文。对于专有名词、品牌名、人名等，采用通用的翻译方式。如果原文包含代码片段，保持代码不变。',
  formal: '你是一个专业的商务翻译。请将用户提供的文本翻译成规范的{targetLang}，语气正式、用词严谨。直接返回翻译结果，不要附加任何说明。保持原文格式。专有名词保留英文原文并在括号内标注中文翻译。',
  casual: '你是一个日常口语翻译。请将用户提供的文本翻译成自然的{targetLang}口语，读起来像人话，避免翻译腔。直接返回翻译结果，不要附加说明。可以使用口语化表达和缩略形式。',
  academic: '你是一个学术翻译专家。请将用户提供的文本翻译成学术风格的{targetLang}。确保术语准确、逻辑清晰、句式完整。直接返回翻译结果。保留专业术语、引文格式和参考文献标记不变。',
  poetic: '你是一个文学翻译家。请将用户提供的文本翻译成富有文学美感的{targetLang}。保留原文的修辞手法、意象和情感色彩。在准确传达原意的前提下，追求语言的韵律和美感。直接返回翻译结果。',
  tech: '你是一个技术文档翻译专家。请将用户提供的技术文本翻译成{targetLang}。技术术语、专有名词保留英文原文（首次出现时在括号内加注中文）。代码片段、命令行、API 调用保持原样不变。保持原文的 Markdown 格式和层级结构。直接返回翻译结果。'
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
  const customPromptInput = document.getElementById('customPrompt');
  const styleCards = document.querySelectorAll('.style-card');
  const autoTranslateCheckbox = document.getElementById('autoTranslate');
  const wordbookList = document.getElementById('wordbookList');
  const wordbookEmpty = document.getElementById('wordbookEmpty');
  const wordbookCount = document.getElementById('wordbookCount');
  const wordbookSearch = document.getElementById('wordbookSearch');
  const exportWordbookBtn = document.getElementById('exportWordbookBtn');
  const clearWordbookBtn = document.getElementById('clearWordbookBtn');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const historyCount = document.getElementById('historyCount');
  const historySearch = document.getElementById('historySearch');
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById('tab-' + item.dataset.tab).classList.add('active');
      if (item.dataset.tab === 'wordbook') loadWordbook();
      if (item.dataset.tab === 'history') loadHistory();
    });
  });

  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
  });

  hintChips.forEach(chip => {
    chip.addEventListener('click', () => { modelInput.value = chip.dataset.model; });
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

  styleCards.forEach(card => {
    card.addEventListener('click', () => {
      styleCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      customPromptInput.value = STYLE_PRESETS[card.dataset.style];
    });
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
      customPromptInput.value = config.customPrompt || '';
      autoTranslateCheckbox.checked = !!config.autoTranslate;

      const theme = ['auto', 'light', 'dark'].includes(config.theme) ? config.theme : 'auto';
      const themeRadio = document.querySelector('input[name="theme"][value="' + theme + '"]');
      if (themeRadio) {
        themeRadio.checked = true;
        const themeCard = themeRadio.closest('.theme-card');
        if (themeCard) themeCard.classList.add('active');
      }

      presetBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.url === config.apiUrl);
      });

      if (!config.customPrompt) {
        styleCards.forEach(c => c.classList.remove('active'));
        document.querySelector('.style-card[data-style="standard"]')?.classList.add('active');
      } else {
        let matched = false;
        styleCards.forEach(c => {
          if (STYLE_PRESETS[c.dataset.style] === config.customPrompt) {
            c.classList.add('active');
            matched = true;
          } else {
            c.classList.remove('active');
          }
        });
        if (!matched && config.customPrompt) {
          styleCards.forEach(c => c.classList.remove('active'));
        }
      }
    } catch (err) {
      console.error('加载配置失败:', err);
    }
  }

  async function saveConfig() {
    try {
      const apiUrl = apiUrlInput.value.trim();
      if (!apiUrl) { showStatus('请先输入 API URL', 'error'); return; }
      if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
        showStatus('API URL 必须以 http:// 或 https:// 开头', 'error');
        return;
      }

      const selectedTheme = document.querySelector('input[name="theme"]:checked');
      const currentStored = await chrome.storage.sync.get('targetLang');
      const config = {
        apiUrl: apiUrl,
        apiKey: apiKeyInput.value.trim(),
        model: modelInput.value.trim(),
        targetLang: currentStored.targetLang || 'zh-CN',
        theme: selectedTheme ? selectedTheme.value : 'auto',
        fontSize: parseInt(fontSizeInput.value, 10) || 14,
        customPrompt: customPromptInput.value.trim(),
        autoTranslate: autoTranslateCheckbox.checked
      };

      await chrome.storage.sync.set(config);
      showStatus('配置已保存', 'success');
    } catch (err) {
      showStatus('保存失败: ' + err.message, 'error');
    }
  }

  async function testConnection() {
    const apiUrl = apiUrlInput.value.trim();
    if (!apiUrl) { showStatus('请先输入 API URL', 'error'); return; }

    testBtn.disabled = true;
    testBtn.textContent = '测试中...';
    showStatus('正在测试连接...', 'info');

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
        showStatus('\u274c ' + (response?.error || '连接失败'), 'error');
      }
    } catch (err) {
      showStatus('\u274c ' + err.message, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> 测试连接';
    }
  }

  async function resetConfig() {
    try {
      await chrome.storage.sync.set(DEFAULT_CONFIG);
      await loadConfig();
      showStatus('已恢复默认设置', 'success');
    } catch (err) {
      showStatus('恢复失败: ' + err.message, 'error');
    }
  }

  let statusTimeout;
  function showStatus(msg, type) {
    if (statusTimeout) clearTimeout(statusTimeout);
    const typeClass = ['error', 'success', 'info'].includes(type) ? ' save-status-' + type : '';
    saveStatus.className = 'save-status' + typeClass;
    saveStatus.textContent = msg;
    statusTimeout = setTimeout(() => {
      saveStatus.className = 'save-status';
      saveStatus.textContent = '';
    }, 3000);
  }

  async function loadWordbook() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getWordbook' });
      if (response?.success) {
        renderWordbook(response.items);
      }
    } catch (err) {
      console.warn('加载单词本失败:', err);
    }
  }

  function renderWordbook(items) {
    const searchTerm = wordbookSearch.value.toLowerCase().trim();
    let filtered = items;
    if (searchTerm) {
      filtered = items.filter(item =>
        item.word.toLowerCase().includes(searchTerm) ||
        item.translation.toLowerCase().includes(searchTerm)
      );
    }

    wordbookCount.textContent = '共 ' + items.length + ' 个词条';

    if (filtered.length === 0) {
      wordbookList.innerHTML = '';
      wordbookEmpty.style.display = 'block';
      const wbP = wordbookEmpty.querySelector('p');
      if (wbP) wbP.textContent = searchTerm ? '没有匹配的单词' : '还没有收藏任何单词';
      return;
    }

    wordbookEmpty.style.display = 'none';
    wordbookList.innerHTML = '';

    filtered.forEach(item => {
      const el = document.createElement('div');
      el.className = 'wordbook-item';

      const info = document.createElement('div');
      info.className = 'wordbook-item-info';

      const wordEl = document.createElement('div');
      wordEl.className = 'wordbook-item-word';
      wordEl.textContent = item.word;

      const transEl = document.createElement('div');
      transEl.className = 'wordbook-item-trans';
      transEl.textContent = item.translation;

      const meta = document.createElement('div');
      meta.className = 'wordbook-item-meta';
      const langInfo = item.targetLang ? '\u2192 ' + item.targetLang : '';
      const date = new Date(item.timestamp);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      meta.textContent = [langInfo, dateStr].filter(Boolean).join(' \u00b7 ');

      info.appendChild(wordEl);
      info.appendChild(transEl);
      info.appendChild(meta);

      const delBtn = document.createElement('button');
      delBtn.className = 'wordbook-item-del';
      delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      delBtn.title = '删除';
      delBtn.addEventListener('click', async () => {
        try {
          const res = await chrome.runtime.sendMessage({ action: 'deleteWord', id: item.id });
          if (res?.success) renderWordbook(res.items);
        } catch (err) { console.warn('删除失败:', err); }
      });

      el.appendChild(info);
      el.appendChild(delBtn);
      wordbookList.appendChild(el);
    });
  }

  let searchDebounce;
  wordbookSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadWordbook, 300);
  });

  exportWordbookBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'exportWordbook' });
      if (response?.success && response.data) {
        const blob = new Blob([response.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wordbook_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      showStatus('导出失败: ' + err.message, 'error');
    }
  });

  clearWordbookBtn.addEventListener('click', async () => {
    if (!confirm('确认清空所有收藏的单词？此操作不可恢复。')) return;
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearWordbook' });
      if (response?.success) {
        renderWordbook([]);
        showStatus('单词本已清空', 'success');
      }
    } catch (err) {
      showStatus('清空失败: ' + err.message, 'error');
    }
  });

  async function loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      if (response?.success) {
        renderHistory(response.items);
      }
    } catch (err) {
      console.warn('加载翻译记录失败:', err);
    }
  }

  function renderHistory(items) {
    const searchTerm = historySearch.value.toLowerCase().trim();
    let filtered = items;
    if (searchTerm) {
      filtered = items.filter(item =>
        item.source.toLowerCase().includes(searchTerm) ||
        item.translation.toLowerCase().includes(searchTerm)
      );
    }

    historyCount.textContent = '共 ' + items.length + ' 条记录（最多 200 条）';

    if (filtered.length === 0) {
      historyList.innerHTML = '';
      historyEmpty.style.display = 'block';
      const hP = historyEmpty.querySelector('p');
      if (hP) hP.textContent = searchTerm ? '没有匹配的记录' : '还没有翻译记录';
      return;
    }

    historyEmpty.style.display = 'none';
    historyList.innerHTML = '';

    filtered.forEach(item => {
      const el = document.createElement('div');
      el.className = 'wordbook-item';

      const info = document.createElement('div');
      info.className = 'wordbook-item-info';

      const sourceEl = document.createElement('div');
      sourceEl.className = 'wordbook-item-word';
      sourceEl.textContent = item.source;

      const transEl = document.createElement('div');
      transEl.className = 'wordbook-item-trans';
      transEl.textContent = '\u2192 ' + item.translation;

      const meta = document.createElement('div');
      meta.className = 'wordbook-item-meta';
      const langInfo = item.targetLang ? item.targetLang : '';
      const date = new Date(item.timestamp);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      meta.textContent = [langInfo, dateStr].filter(Boolean).join(' \u00b7 ');

      info.appendChild(sourceEl);
      info.appendChild(transEl);
      info.appendChild(meta);

      const delBtn = document.createElement('button');
      delBtn.className = 'wordbook-item-del';
      delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      delBtn.title = '删除';
      delBtn.addEventListener('click', async () => {
        try {
          const res = await chrome.runtime.sendMessage({ action: 'deleteHistoryEntry', id: item.id });
          if (res?.success) renderHistory(res.items);
        } catch (err) { console.warn('删除记录失败:', err); }
      });

      el.appendChild(info);
      el.appendChild(delBtn);
      historyList.appendChild(el);
    });
  }

  let historySearchDebounce;
  historySearch.addEventListener('input', () => {
    clearTimeout(historySearchDebounce);
    historySearchDebounce = setTimeout(loadHistory, 300);
  });

  exportHistoryBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      if (response?.success && response.items) {
        const data = JSON.stringify(response.items, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'history_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      showStatus('导出失败: ' + err.message, 'error');
    }
  });

  clearHistoryBtn.addEventListener('click', async () => {
    if (!confirm('确认清空所有翻译记录？')) return;
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearHistory' });
      if (response?.success) {
        renderHistory([]);
        showStatus('翻译记录已清空', 'success');
      }
    } catch (err) {
      showStatus('清空失败: ' + err.message, 'error');
    }
  });

  testBtn.addEventListener('click', testConnection);
  saveBtn.addEventListener('click', saveConfig);
  resetBtn.addEventListener('click', resetConfig);

  await loadConfig();
});
