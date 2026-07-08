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

const LANGUAGE_NAMES = {
  'zh-CN': '简体中文', 'zh-TW': '繁体中文', 'en': '英语', 'ja': '日语',
  'ko': '韩语', 'fr': '法语', 'de': '德语', 'es': '西班牙语', 'pt': '葡萄牙语',
  'ru': '俄语', 'ar': '阿拉伯语', 'hi': '印地语', 'th': '泰语', 'vi': '越南语',
  'it': '意大利语', 'nl': '荷兰语', 'pl': '波兰语', 'tr': '土耳其语', 'id': '印尼语', 'ms': '马来语'
};

const _t = (key, ...args) => {
  let msg = chrome.i18n.getMessage(key);
  if (!msg) return key;
  args.forEach((arg, i) => { msg = msg.replace(new RegExp('\\$' + (i + 1), 'g'), String(arg)); });
  return msg;
};

const DEFAULT_PROMPT = `你是一个专业的翻译助手。请将用户提供的文本翻译成{targetLang}。

要求：
1. 直接返回翻译结果，不要包含任何解释、说明、元信息或额外内容
2. 保持原文的格式（包括换行、标点符号、空行等）
3. 如果原文已经是{targetLang}，直接返回原文
4. 对于专有名词、品牌名、人名等，采用通用的翻译或音译方式
5. 如果原文包含代码片段，保持代码不变
6. 如果原文是单个词语，给出最常用、最准确的翻译`;

const API_TIMEOUT = 30000;

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  const needsInit = Object.keys(DEFAULT_CONFIG).some(key => stored[key] === undefined);
  if (needsInit || details.reason === 'install') {
    await chrome.storage.sync.set(DEFAULT_CONFIG);
  }
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: chrome.i18n.getMessage('contextMenuTranslate'),
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    const trySend = (retries = 3) => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'translateSelection',
        text: info.selectionText
      }).catch(() => {
        if (retries > 0) setTimeout(() => trySend(retries - 1), 200);
      });
    };
    trySend();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'translate_selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    try {
      const [execResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() || ''
      });
      const selectedText = execResult?.result;
      if (selectedText && selectedText.trim()) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'translateSelection',
          text: selectedText.trim()
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Command executeScript failed:', err);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'translate':
      translateText(message.text, message.targetLang)
        .then(result => sendResponse({ success: true, translation: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    case 'testConnection':
      testConnection(message.apiUrl, message.apiKey, message.model)
        .then(result => sendResponse({ success: true, message: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    case 'getConfig':
      chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG)).then(stored => {
        const config = { ...DEFAULT_CONFIG };
        for (const key of Object.keys(DEFAULT_CONFIG)) {
          if (stored[key] !== undefined) config[key] = stored[key];
        }
        sendResponse({ success: true, config });
      }).catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'addWord':
      addWordToBook(message.entry)
        .then(wb => sendResponse({ success: true, wordbook: wb }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'getWordbook':
      getWordbook()
        .then(items => sendResponse({ success: true, items }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'deleteWord':
      deleteWordFromBook(message.id)
        .then(items => sendResponse({ success: true, items }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'clearWordbook':
      clearWordbook()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'exportWordbook':
      getWordbook()
        .then(items => sendResponse({ success: true, data: JSON.stringify(items, null, 2) }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'getHistory':
      getHistory()
        .then(items => sendResponse({ success: true, items }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'addHistory':
      addHistory(message.entry)
        .then(items => sendResponse({ success: true, items }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'deleteHistoryEntry':
      deleteHistoryEntry(message.id)
        .then(items => sendResponse({ success: true, items }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'clearHistory':
      clearHistory()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    default:
      sendResponse({ success: false, error: 'Unknown action: ' + message.action });
      return false;
  }
});

async function apiFetch(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateText(text, targetLang) {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  const apiUrl = stored.apiUrl || DEFAULT_CONFIG.apiUrl;
  const apiKey = stored.apiKey || DEFAULT_CONFIG.apiKey;
  const model = stored.model || '';
  const targetLanguage = targetLang || stored.targetLang || DEFAULT_CONFIG.targetLang;
  const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  const customPrompt = stored.customPrompt || '';
  const systemPrompt = customPrompt
    ? customPrompt.replace(/\{targetLang\}/g, targetLangName)
    : DEFAULT_PROMPT.replace(/\{targetLang\}/g, targetLangName);

  const requestBody = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.3,
    max_tokens: Math.min(4096, Math.max(1024, text.length * 2)),
    stream: false
  };
  if (model) requestBody.model = model;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

  let response;
  try {
    response = await apiFetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
  } catch (fetchError) {
    if (fetchError.name === 'AbortError') throw new Error('请求超时，请检查 API 服务是否正常');
    throw new Error(_t('errorNoApiUrlDetail', apiUrl, fetchError.message));
  }

  const bodyText = await response.text();
  if (!response.ok) {
    let errorDetail = bodyText;
    try {
      const errorJson = JSON.parse(bodyText);
      errorDetail = errorJson.error?.message || JSON.stringify(errorJson);
    } catch {}
    throw new Error(_t('errorApiRequestFailed', response.status, errorDetail));
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(_t('errorParseResponse', bodyText.substring(0, 200) || ''));
  }
  let translation = '';
  if (data.choices && data.choices.length > 0) {
    translation = data.choices[0].message?.content?.trim() || '';
  } else if (data.content) {
    translation = data.content.trim();
  } else if (data.response) {
    translation = data.response.trim();
  } else {
    throw new Error(_t('errorNoTranslation'));
  }
  if (!translation) throw new Error(_t('errorEmptyResult'));
  return translation;
}

async function testConnection(apiUrl, apiKey, model) {
  if (!apiUrl) throw new Error(_t('inputApiUrl'));
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    throw new Error(_t('inputApiUrlPrefix'));
  }

  const requestBody = {
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 5, stream: false
  };
  if (model) requestBody.model = model;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

  const startTime = Date.now();
  const response = await apiFetch(apiUrl, {
    method: 'POST', headers, body: JSON.stringify(requestBody)
  });
  const elapsed = Date.now() - startTime;

  const bodyText = await response.text();
  if (!response.ok) {
    let detail = bodyText;
    try { const j = JSON.parse(bodyText); detail = j.error?.message || JSON.stringify(j); } catch {}
    throw new Error(_t('testFailedDetail', response.status, elapsed, detail));
  }

  let data;
  try { data = JSON.parse(bodyText); } catch { throw new Error(_t('invalidJsonResponse')); }

  const modelName = data.model || model || 'unknown';
  return _t('connectionSuccess', elapsed, modelName);
}

async function getWordbook() {
  const stored = await chrome.storage.local.get('wordbook');
  return stored.wordbook || [];
}

async function addWordToBook(entry) {
  if (!entry.word || !entry.translation) throw new Error(_t('wordAndTransRequired'));
  const wordbook = await getWordbook();
  const wordLower = entry.word.substring(0, 500).toLowerCase();
  const existingIndex = wordbook.findIndex(item => item.word.toLowerCase() === wordLower);
  if (existingIndex !== -1) {
    wordbook[existingIndex].translation = entry.translation.substring(0, 2000);
    wordbook[existingIndex].timestamp = Date.now();
    const item = wordbook.splice(existingIndex, 1)[0];
    wordbook.unshift(item);
  } else {
    wordbook.unshift({
      id: Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8),
      word: entry.word.substring(0, 500),
      translation: entry.translation.substring(0, 2000),
      sourceLang: entry.sourceLang || '',
      targetLang: entry.targetLang || '',
      timestamp: Date.now()
    });
  }
  await chrome.storage.local.set({ wordbook });
  return wordbook;
}

async function deleteWordFromBook(id) {
  if (!id) throw new Error(_t('wordIdRequired'));
  let wordbook = await getWordbook();
  wordbook = wordbook.filter(item => item.id !== id);
  await chrome.storage.local.set({ wordbook });
  return wordbook;
}

async function clearWordbook() {
  await chrome.storage.local.set({ wordbook: [] });
}

async function getHistory() {
  const stored = await chrome.storage.local.get('history');
  return stored.history || [];
}

async function addHistory(entry) {
  if (!entry.source || !entry.translation) return;
  const history = await getHistory();
  history.unshift({
    id: Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8),
    source: entry.source.substring(0, 500),
    translation: entry.translation.substring(0, 2000),
    targetLang: entry.targetLang || '',
    timestamp: Date.now()
  });
  if (history.length > 200) history.length = 200;
  await chrome.storage.local.set({ history });
  return history;
}

async function clearHistory() {
  await chrome.storage.local.set({ history: [] });
}

async function deleteHistoryEntry(id) {
  if (!id) throw new Error('Missing history entry ID');
  const history = await getHistory();
  const filtered = history.filter(item => item.id !== id);
  await chrome.storage.local.set({ history: filtered });
  return filtered;
}
