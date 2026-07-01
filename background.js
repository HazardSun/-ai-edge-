const DEFAULT_CONFIG = {
  apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
  apiKey: '',
  model: '',
  targetLang: 'zh-CN',
  fontSize: 14,
  theme: 'auto'
};

const LANGUAGE_NAMES = {
  'zh-CN': '\u7b80\u4f53\u4e2d\u6587',
  'zh-TW': '\u7e41\u4f53\u4e2d\u6587',
  'en': '\u82f1\u8bed',
  'ja': '\u65e5\u8bed',
  'ko': '\u97e9\u8bed',
  'fr': '\u6cd5\u8bed',
  'de': '\u5fb7\u8bed',
  'es': '\u897f\u73ed\u7259\u8bed',
  'pt': '\u8461\u8404\u7259\u8bed',
  'ru': '\u4fc4\u8bed',
  'ar': '\u963f\u62c9\u4f2f\u8bed',
  'hi': '\u5370\u5730\u8bed',
  'th': '\u6cf0\u8bed',
  'vi': '\u8d8a\u5357\u8bed',
  'it': '\u610f\u5927\u5229\u8bed',
  'nl': '\u8377\u5170\u8bed',
  'pl': '\u6ce2\u5170\u8bed',
  'tr': '\u571f\u8033\u5176\u8bed',
  'id': '\u5370\u5c3c\u8bed',
  'ms': '\u9a6c\u6765\u8bed'
};

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
    case 'detectLanguage':
      chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG)).then(stored => {
        const config = { ...DEFAULT_CONFIG };
        for (const key of Object.keys(DEFAULT_CONFIG)) {
          if (stored[key] !== undefined) config[key] = stored[key];
        }
        sendResponse({ success: true, config });
      }).catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'getDefaultConfig':
      sendResponse({ success: true, config: { ...DEFAULT_CONFIG } });
      return true;
    default:
      sendResponse({ success: false, error: 'Unknown action: ' + message.action });
      return false;
  }
});

async function translateText(text, targetLang) {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  const apiUrl = stored.apiUrl || DEFAULT_CONFIG.apiUrl;
  const apiKey = stored.apiKey || DEFAULT_CONFIG.apiKey;
  const model = stored.model || '';
  const targetLanguage = targetLang || stored.targetLang || DEFAULT_CONFIG.targetLang;
  const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  const systemPrompt = `\u4f60\u662f\u4e00\u4e2a\u4e13\u4e1a\u7684\u7ffb\u8bd1\u52a9\u624b\u3002\u8bf7\u5c06\u7528\u6237\u63d0\u4f9b\u7684\u6587\u672c\u7ffb\u8bd1\u6210${targetLangName}\u3002\n\n\u8981\u6c42\uff1a\n1. \u76f4\u63a5\u8fd4\u56de\u7ffb\u8bd1\u7ed3\u679c\uff0c\u4e0d\u8981\u5305\u542b\u4efb\u4f55\u89e3\u91ca\u3001\u8bf4\u660e\u3001\u5143\u4fe1\u606f\u6216\u989d\u5916\u5185\u5bb9\n2. \u4fdd\u6301\u539f\u6587\u7684\u683c\u5f0f\uff08\u5305\u62ec\u6362\u884c\u3001\u6807\u70b9\u7b26\u53f7\u3001\u7a7a\u884c\u7b49\uff09\n3. \u5982\u679c\u539f\u6587\u5df2\u7ecf\u662f${targetLangName}\uff0c\u76f4\u63a5\u8fd4\u56de\u539f\u6587\n4. \u5bf9\u4e8e\u4e13\u6709\u540d\u8bcd\u3001\u54c1\u724c\u540d\u3001\u4eba\u540d\u7b49\uff0c\u91c7\u7528\u901a\u7528\u7684\u7ffb\u8bd1\u6216\u97f3\u8bd1\u65b9\u5f0f\n5. \u5982\u679c\u539f\u6587\u5305\u542b\u4ee3\u7801\u7247\u6bb5\uff0c\u4fdd\u6301\u4ee3\u7801\u4e0d\u53d8\n6. \u5982\u679c\u539f\u6587\u662f\u5355\u4e2a\u8bcd\u8bed\uff0c\u7ed9\u51fa\u6700\u5e38\u7528\u3001\u6700\u51c6\u786e\u7684\u7ffb\u8bd1`;

  const requestBody = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.3,
    max_tokens: Math.min(4096, Math.max(1024, text.length * 2)),
    stream: false
  };

  if (model) {
    requestBody.model = model;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = 'Bearer ' + apiKey;
  }

  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
  } catch (fetchError) {
    throw new Error('\u65e0\u6cd5\u8fde\u63a5\u5230 API \u670d\u52a1\u5668 (' + apiUrl + ')\u3002\u8bf7\u68c0\u67e5\uff1a\n1. API URL \u662f\u5426\u6b63\u786e\n2. \u670d\u52a1\u662f\u5426\u6b63\u5728\u8fd0\u884c\n3. \u7f51\u7edc\u8fde\u63a5\u662f\u5426\u6b63\u5e38\n\n\u8be6\u7ec6\u9519\u8bef\uff1a' + fetchError.message);
  }

  const bodyText = await response.text();
  if (!response.ok) {
    let errorDetail = bodyText;
    try {
      const errorJson = JSON.parse(bodyText);
      errorDetail = errorJson.error?.message || JSON.stringify(errorJson);
    } catch {}
    throw new Error('API \u8bf7\u6c42\u5931\u8d25 (HTTP ' + response.status + '): ' + errorDetail);
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error('API \u8fd4\u56de\u7684\u6570\u636e\u683c\u5f0f\u4e0d\u6b63\u786e\uff0c\u65e0\u6cd5\u89e3\u6790\u4e3a JSON\u3002\u8bf7\u68c0\u67e5 API URL \u662f\u5426\u6b63\u786e\u3002\u8fd4\u56de\u5185\u5bb9\uff1a' + (bodyText.substring(0, 200) || '\u7a7a'));
  }
  let translation = '';
  if (data.choices && data.choices.length > 0) {
    translation = data.choices[0].message?.content?.trim() || '';
  } else if (data.content) {
    translation = data.content.trim();
  } else if (data.response) {
    translation = data.response.trim();
  } else {
    throw new Error('\u65e0\u6cd5\u4ece API \u54cd\u5e94\u4e2d\u89e3\u6790\u7ffb\u8bd1\u7ed3\u679c\uff0c\u8bf7\u68c0\u67e5\u8fd4\u56de\u683c\u5f0f');
  }
  if (!translation) {
    throw new Error('\u7ffb\u8bd1\u7ed3\u679c\u4e3a\u7a7a\uff0c\u8bf7\u91cd\u8bd5');
  }
  return translation;
}

async function detectLanguage(text) {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  const apiUrl = stored.apiUrl || DEFAULT_CONFIG.apiUrl;
  const apiKey = stored.apiKey || DEFAULT_CONFIG.apiKey;
  const model = stored.model || '';

  const systemPrompt = '\u4f60\u662f\u4e00\u4e2a\u8bed\u8a00\u68c0\u6d4b\u4e13\u5bb6\u3002\u8bf7\u68c0\u6d4b\u4ee5\u4e0b\u6587\u672c\u7684\u8bed\u8a00\uff0c\u53ea\u8fd4\u56de\u8bed\u8a00\u4ee3\u7801\uff08\u5982\uff1azh-CN, en, ja, ko, fr, de, es, pt, ru, ar, hi, th \u7b49\uff09\uff0c\u4e0d\u8981\u4efb\u4f55\u5176\u4ed6\u5185\u5bb9\u3002\u5982\u679c\u65e0\u6cd5\u786e\u5b9a\uff0c\u8fd4\u56de "unknown"\u3002';

  const requestBody = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text.substring(0, 1000) }
    ],
    temperature: 0.1,
    max_tokens: 20,
    stream: false
  };
  if (model) requestBody.model = model;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

  const response = await fetch(apiUrl, {
    method: 'POST', headers, body: JSON.stringify(requestBody)
  });
  const bodyText = await response.text();
  if (!response.ok) throw new Error('API \u8bf7\u6c42\u5931\u8d25 (HTTP ' + response.status + '): ' + (bodyText.substring(0, 100) || '\u65e0\u8fd4\u56de\u5185\u5bb9'));
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error('API \u8fd4\u56de\u7684\u6570\u636e\u683c\u5f0f\u4e0d\u6b63\u786e\uff0c\u65e0\u6cd5\u89e3\u6790\u4e3a JSON');
  }
  return data.choices?.[0]?.message?.content?.trim() || 'unknown';
}

async function testConnection(apiUrl, apiKey, model) {
  if (!apiUrl) throw new Error('\u8bf7\u8f93\u5165 API URL');
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    throw new Error('API URL \u5fc5\u987b\u4ee5 http:// \u6216 https:// \u5f00\u5934');
  }

  const requestBody = {
    messages: [
      { role: 'user', content: 'Hi' }
    ],
    max_tokens: 5,
    stream: false
  };
  if (model) requestBody.model = model;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

  const startTime = Date.now();
  const response = await fetch(apiUrl, {
    method: 'POST', headers, body: JSON.stringify(requestBody)
  });
  const elapsed = Date.now() - startTime;

  const bodyText = await response.text();
  if (!response.ok) {
    let detail = bodyText;
    try { const j = JSON.parse(bodyText); detail = j.error?.message || JSON.stringify(j); } catch {}
    throw new Error('\u8fde\u63a5\u5931\u8d25 (HTTP ' + response.status + ', ' + elapsed + 'ms): ' + detail);
  }

  let data;
  try { data = JSON.parse(bodyText); } catch {
    throw new Error('\u8fd4\u56de\u6570\u636e\u4e0d\u662f\u6709\u6548\u7684 JSON \u683c\u5f0f');
  }

  const modelName = data.model || model || '\u9ed8\u8ba4\u6a21\u578b';
  return '\u8fde\u63a5\u6210\u529f\uff01\u54cd\u5e94\u65f6\u95f4: ' + elapsed + 'ms, \u6a21\u578b: ' + modelName;
}
