const { test, expect } = require('@playwright/test');
const http = require('http');
const {
  createExtensionContext,
  openPopupPage,
  openOptionsPage,
  createTestHtml,
  readManifest,
  fileExists,
  selectText
} = require('./helpers');

let context;
let extensionId;
let testServer;
let testServerPort;

test.beforeAll(async () => {
  const headless = process.env.HEADLESS === 'true';
  const result = await createExtensionContext(headless);
  context = result.context;
  extensionId = result.extensionId;
  await startTestServer();
});

test.afterAll(async () => {
  if (testServer) {
    await new Promise(resolve => testServer.close(resolve));
  }
  if (context) {
    await context.close();
  }
});

function startTestServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(createTestHtml());
    });
    server.listen(0, '127.0.0.1', () => {
      testServerPort = server.address().port;
      testServer = server;
      resolve();
    });
    server.on('error', reject);
  });
}

async function openTestPage(context) {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${testServerPort}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  });
  await page.waitForTimeout(1000);
  return page;
}

// ---------------------------------------------------------------------------
// 1. 插件加载 & Manifest 完整性
// ---------------------------------------------------------------------------
test.describe('1. 插件加载 & Manifest 完整性', () => {

  test('1.1 manifest.json 存在且解析正确', () => {
    const manifest = readManifest();
    expect(manifest).toBeDefined();
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe('1.0.0');
  });

  test('1.2 核心 Manifest V3 字段完整', () => {
    const manifest = readManifest();
    expect(manifest).toHaveProperty('action');
    expect(manifest.action).toHaveProperty('default_popup', 'popup.html');
    expect(manifest).toHaveProperty('background');
    expect(manifest.background).toHaveProperty('service_worker', 'background.js');
    expect(manifest.background).toHaveProperty('type', 'module');
    expect(manifest).toHaveProperty('permissions');
    expect(manifest).toHaveProperty('host_permissions');
    expect(manifest).toHaveProperty('commands');
  });

  test('1.3 permissions 包含必要权限', () => {
    const manifest = readManifest();
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('contextMenus');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
    expect(manifest.host_permissions).toContain('<all_urls>');
  });

  test('1.4 所有引用的资源文件存在', () => {
    expect(fileExists('background.js')).toBe(true);
    expect(fileExists('content.js')).toBe(true);
    expect(fileExists('popup.js')).toBe(true);
    expect(fileExists('options.js')).toBe(true);
    expect(fileExists('popup.html')).toBe(true);
    expect(fileExists('options.html')).toBe(true);
    expect(fileExists('content.css')).toBe(true);
    expect(fileExists('popup.css')).toBe(true);
    expect(fileExists('options.css')).toBe(true);
    expect(fileExists('icons', 'icon16.svg')).toBe(true);
    expect(fileExists('icons', 'icon48.svg')).toBe(true);
    expect(fileExists('icons', 'icon128.svg')).toBe(true);
    expect(fileExists('_locales', 'zh_CN', 'messages.json')).toBe(true);
    expect(fileExists('_locales', 'en', 'messages.json')).toBe(true);
  });

  test('1.5 options_ui 使用 open_in_tab 模式', () => {
    const manifest = readManifest();
    expect(manifest).toHaveProperty('options_ui');
    expect(manifest.options_ui).toHaveProperty('page', 'options.html');
    expect(manifest.options_ui).toHaveProperty('open_in_tab', true);
  });

  test('1.6 Service Worker 成功注册并能响应消息', async () => {
    const workers = context.serviceWorkers;
    expect(workers.length).toBeGreaterThanOrEqual(1);
    const sw = workers[0];
    expect(sw.url()).toContain('background.js');

    const defaultConfig = await sw.evaluate(async () => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getDefaultConfig' }, resolve);
      });
    });
    expect(defaultConfig.success).toBe(true);
    expect(defaultConfig.config.apiUrl).toBe('https://opencode.ai/zen/v1/chat/completions');
    expect(defaultConfig.config.targetLang).toBe('zh-CN');
    expect(defaultConfig.config.fontSize).toBe(14);
    expect(defaultConfig.config.theme).toBe('auto');
    expect(defaultConfig.config.apiKey).toBe('');
    expect(defaultConfig.config.model).toBe('');
  });

  test('1.7 Service Worker 能返回已存储配置', async () => {
    const workers = context.serviceWorkers;
    const sw = workers[0];
    const storedConfig = await sw.evaluate(async () => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getConfig' }, resolve);
      });
    });
    expect(storedConfig.success).toBe(true);
    expect(storedConfig.config).toHaveProperty('apiUrl');
    expect(storedConfig.config).toHaveProperty('apiKey');
    expect(storedConfig.config).toHaveProperty('model');
    expect(storedConfig.config).toHaveProperty('targetLang');
    expect(storedConfig.config).toHaveProperty('fontSize');
    expect(storedConfig.config).toHaveProperty('theme');
  });
});

// ---------------------------------------------------------------------------
// 2. Popup UI 交互测试
// ---------------------------------------------------------------------------
test.describe('2. Popup UI 交互测试', () => {

  test('2.1 Popup 页面正常渲染所有元素', async () => {
    const popup = await openPopupPage(context, extensionId);
    await expect(popup.locator('.popup-container')).toBeVisible();
    await expect(popup.locator('.popup-topbar')).toBeVisible();
    await expect(popup.locator('.popup-brand')).toBeVisible();
    await expect(popup.locator('#openSettings')).toBeVisible();
    await expect(popup.locator('.popup-lang-row')).toBeVisible();
    await expect(popup.locator('#popupTargetLang')).toBeVisible();
    await expect(popup.locator('#popupInputText')).toBeVisible();
    await expect(popup.locator('#translateBtn')).toBeVisible();
    await expect(popup.locator('#clearBtn')).toBeVisible();
    await expect(popup.locator('#popupResult')).toBeHidden();
    await expect(popup.locator('#popupStatus')).toBeVisible();
    await popup.close();
  });

  test('2.2 清空按钮功能', async () => {
    const popup = await openPopupPage(context, extensionId);
    await popup.locator('#popupInputText').fill('临时文本');
    expect(await popup.locator('#popupInputText').inputValue()).toBe('临时文本');
    await popup.locator('#clearBtn').click();
    expect(await popup.locator('#popupInputText').inputValue()).toBe('');
    // 清空后结果区域应隐藏
    await expect(popup.locator('#popupResult')).toBeHidden();
    await popup.close();
  });

  test('2.3 切换目标语言', async () => {
    const popup = await openPopupPage(context, extensionId);
    const select = popup.locator('#popupTargetLang');
    expect(await select.inputValue()).toBe('zh-CN');
    await select.selectOption('en');
    expect(await select.inputValue()).toBe('en');
    await select.selectOption('ja');
    expect(await select.inputValue()).toBe('ja');
    await select.selectOption('fr');
    expect(await select.inputValue()).toBe('fr');
    await select.selectOption('zh-CN');
    expect(await select.inputValue()).toBe('zh-CN');
    await popup.close();
  });

  test('2.4 点击设置按钮打开选项页', async () => {
    const popup = await openPopupPage(context, extensionId);
    await popup.locator('#openSettings').click();
    await popup.waitForTimeout(1000);
    const allPages = context.pages();
    const optionsPage = allPages.find(p => p.url().includes('options.html'));
    expect(optionsPage).toBeDefined();
    await popup.close();
  });

  test('2.5 空输入时点击翻译显示提示', async () => {
    const popup = await openPopupPage(context, extensionId);
    await popup.locator('#translateBtn').click();
    await popup.waitForTimeout(500);
    const statusText = await popup.locator('#popupStatus').textContent();
    expect(statusText.length).toBeGreaterThan(0);
    // 结果区域不应显示
    await expect(popup.locator('#popupResult')).toBeHidden();
    await popup.close();
  });

  test('2.6 Ctrl+Enter 快捷键触发翻译', async () => {
    const popup = await openPopupPage(context, extensionId);
    await popup.locator('#popupInputText').fill('Hello World');
    // 模拟 Ctrl+Enter
    await popup.locator('#popupInputText').press('Control+Enter');
    await popup.waitForTimeout(500);
    // 结果区域应该显示(虽然 API 会失败,但 UI 会显示结果区域)
    await expect(popup.locator('#popupResult')).toBeVisible();
    await popup.close();
  });

  test('2.7 翻译结果区域包含复制按钮', async () => {
    const popup = await openPopupPage(context, extensionId);
    await popup.locator('#popupInputText').fill('Test text');
    await popup.locator('#translateBtn').click();
    await popup.waitForTimeout(800);
    // 结果区域应出现
    await expect(popup.locator('#popupResult')).toBeVisible();
    // 复制按钮存在
    await expect(popup.locator('#popupCopyBtn')).toBeVisible();
    await popup.close();
  });
});

// ---------------------------------------------------------------------------
// 3. Content Script 注入 & 翻译浮窗测试
// ---------------------------------------------------------------------------
test.describe('3. Content Script 注入 & 翻译浮窗测试', () => {

  test('3.1 content script 成功注入到页面', async () => {
    const page = await openTestPage(context);
    const canMessage = await page.evaluate(() => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getDefaultConfig' }, response => {
          resolve(response?.success === true);
        });
      });
    });
    expect(canMessage).toBe(true);
    await page.close();
  });

  test('3.2 选中文本时浮动翻译图标出现', async () => {
    const page = await openTestPage(context);
    await selectText(page, '#target p:first-child');
    await page.dispatchEvent('#target', 'mouseup', { bubbles: true });
    await page.waitForTimeout(800);
    const iconState = await page.evaluate(() => {
      const icon = document.getElementById('ai-translate-icon');
      if (!icon) return { exists: false };
      return { exists: true, display: icon.style.display };
    });
    expect(iconState.exists).toBe(true);
    expect(iconState.display).toBe('flex');
    await page.close();
  });

  test('3.3 点击浮动图标弹出翻译浮窗', async () => {
    const page = await openTestPage(context);
    await selectText(page, '#target p:first-child');
    await page.dispatchEvent('#target', 'mouseup', { bubbles: true });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const icon = document.getElementById('ai-translate-icon');
      if (icon) icon.click();
    });
    await page.waitForTimeout(1500);
    const popupInfo = await page.evaluate(() => {
      const popup = document.getElementById('ai-translate-popup');
      if (!popup) return null;
      return {
        exists: true,
        headerExists: !!popup.querySelector('.popup-header'),
        sourceExists: !!popup.querySelector('.popup-source'),
        resultExists: !!popup.querySelector('.popup-result'),
        actionsExist: !!popup.querySelector('.popup-actions'),
        closeExists: !!popup.querySelector('.popup-close')
      };
    });
    expect(popupInfo).not.toBeNull();
    expect(popupInfo.exists).toBe(true);
    expect(popupInfo.headerExists).toBe(true);
    expect(popupInfo.sourceExists).toBe(true);
    expect(popupInfo.resultExists).toBe(true);
    expect(popupInfo.actionsExist).toBe(true);
    expect(popupInfo.closeExists).toBe(true);
    await page.close();
  });

  test('3.4 翻译浮窗中显示原文', async () => {
    const page = await openTestPage(context);
    await selectText(page, '#target p:first-child');
    await page.dispatchEvent('#target', 'mouseup', { bubbles: true });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.getElementById('ai-translate-icon')?.click());
    await page.waitForTimeout(1000);
    const sourceText = await page.evaluate(() => {
      const popup = document.getElementById('ai-translate-popup');
      return popup?.querySelector('.popup-source')?.textContent || '';
    });
    expect(sourceText.length).toBeGreaterThan(0);
    expect(sourceText).toContain('Select this text');
    await page.close();
  });

  test('3.5 Escape 键关闭浮窗', async () => {
    const page = await openTestPage(context);
    await selectText(page, '#target p:first-child');
    await page.dispatchEvent('#target', 'mouseup', { bubbles: true });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('ai-translate-icon')?.click());
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => !!document.getElementById('ai-translate-popup'))).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.getElementById('ai-translate-popup'))).toBeNull();
    await page.close();
  });

  test('3.6 页面滚动时浮窗自动隐藏', async () => {
    const page = await openTestPage(context);
    await selectText(page, '#target');
    await page.dispatchEvent('#target', 'mouseup', { bubbles: true });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('ai-translate-icon')?.click());
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => !!document.getElementById('ai-translate-popup'))).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => !!document.getElementById('ai-translate-popup'))).toBe(false);
    await page.close();
  });

  test('3.7 浮窗包含复制和重试按钮', async () => {
    const page = await openTestPage(context);
    await selectText(page, '#target p:first-child');
    await page.dispatchEvent('#target', 'mouseup', { bubbles: true });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('ai-translate-icon')?.click());
    await page.waitForTimeout(1500);
    const actions = await page.evaluate(() => {
      const popup = document.getElementById('ai-translate-popup');
      if (!popup) return null;
      const btns = popup.querySelectorAll('.popup-btn');
      return {
        count: btns.length,
        texts: Array.from(btns).map(b => b.textContent)
      };
    });
    expect(actions).not.toBeNull();
    expect(actions.count).toBeGreaterThanOrEqual(2);
    await page.close();
  });
});

// ---------------------------------------------------------------------------
// 4. Options 页面测试（新版侧边栏 + 卡片设计）
// ---------------------------------------------------------------------------
test.describe('4. Options 页面测试', () => {

  test('4.1 Options 页面正常渲染整体布局', async () => {
    const options = await openOptionsPage(context, extensionId);
    await expect(options.locator('.layout')).toBeVisible();
    await expect(options.locator('.sidebar')).toBeVisible();
    await expect(options.locator('.sidebar-header')).toBeVisible();
    await expect(options.locator('.nav-item')).toHaveCount(2);
    await expect(options.locator('.nav-item[data-tab="general"]')).toBeVisible();
    await expect(options.locator('.nav-item[data-tab="appearance"]')).toBeVisible();
    await expect(options.locator('.sidebar-footer .version')).toBeVisible();
    await expect(options.locator('.main')).toBeVisible();
    // 默认 general tab 激活
    await expect(options.locator('#tab-general')).toHaveClass(/active/);
    await options.close();
  });

  test('4.2 连接设置卡片字段完整', async () => {
    const options = await openOptionsPage(context, extensionId);
    // 三张卡片
    await expect(options.locator('.card')).toHaveCount(3);
    // API URL 卡片
    await expect(options.locator('#apiUrl')).toBeVisible();
    await expect(options.locator('.preset-btns')).toBeVisible();
    await expect(options.locator('.preset-btn')).toHaveCount(6);
    // API Key 卡片
    await expect(options.locator('#apiKey')).toBeVisible();
    await expect(options.locator('#toggleApiKey')).toBeVisible();
    // Model 卡片
    await expect(options.locator('#model')).toBeVisible();
    await expect(options.locator('.hint-chip')).toHaveCount(6);
    // 操作按钮
    await expect(options.locator('#saveBtn')).toBeVisible();
    await expect(options.locator('#resetBtn')).toBeVisible();
    await expect(options.locator('#saveStatus')).toBeVisible();
    // 默认值
    expect(await options.locator('#apiUrl').inputValue()).toBe('https://opencode.ai/zen/v1/chat/completions');
    await options.close();
  });

  test('4.3 预设按钮顺序及自动填充 API URL', async () => {
    const options = await openOptionsPage(context, extensionId);
    const presetBtns = options.locator('.preset-btn');

    // 验证预设按钮顺序：OpenCode(0), DeepSeek(1), OpenAI(2), Moonshot(3), Ollama(4), LM Studio(5)
    const presets = [
      { index: 0, name: 'OpenCode', url: 'https://opencode.ai/zen/v1/chat/completions' },
      { index: 1, name: 'DeepSeek', url: 'https://api.deepseek.com/v1/chat/completions' },
      { index: 2, name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions' },
      { index: 3, name: 'Moonshot', url: 'https://api.moonshot.cn/v1/chat/completions' },
      { index: 4, name: 'Ollama', url: 'http://localhost:11434/v1/chat/completions' },
      { index: 5, name: 'LM Studio', url: 'http://localhost:1234/v1/chat/completions' }
    ];

    // 验证每个预设按钮
    for (const preset of presets) {
      const btn = presetBtns.nth(preset.index);
      await expect(btn).toContainText(preset.name);
    }

    // 测试第一个(OpenCode)默认激活
    await expect(presetBtns.nth(0)).toHaveClass(/active/);

    // 逐一测试点击填充
    for (const preset of presets) {
      await presetBtns.nth(preset.index).click();
      await options.waitForTimeout(200);
      expect(await options.locator('#apiUrl').inputValue()).toBe(preset.url);
      await expect(presetBtns.nth(preset.index)).toHaveClass(/active/);
    }
    await options.close();
  });

  test('4.4 API Key 显示/隐藏切换', async () => {
    const options = await openOptionsPage(context, extensionId);
    const apiKeyInput = options.locator('#apiKey');
    const toggleBtn = options.locator('#toggleApiKey');

    // 初始为 password 类型
    expect(await apiKeyInput.getAttribute('type')).toBe('password');
    await toggleBtn.click();
    await options.waitForTimeout(200);
    expect(await apiKeyInput.getAttribute('type')).toBe('text');
    // 再切回
    await toggleBtn.click();
    await options.waitForTimeout(200);
    expect(await apiKeyInput.getAttribute('type')).toBe('password');
    await options.close();
  });

  test('4.5 模型提示芯片点击填充', async () => {
    const options = await openOptionsPage(context, extensionId);
    const modelInput = options.locator('#model');
    const hintChips = options.locator('.hint-chip');

    await expect(hintChips).toHaveCount(6);

    // 测试每个 chip 点击后的填充
    const models = ['gpt-4o', 'gpt-4o-mini', 'deepseek-chat', 'deepseek-reasoner', 'moonshot-v1-8k', 'qwen-turbo'];
    for (let i = 0; i < models.length; i++) {
      await hintChips.nth(i).click();
      await options.waitForTimeout(200);
      expect(await modelInput.inputValue()).toBe(models[i]);
    }
    await options.close();
  });

  test('4.6 选项卡切换（连接设置 ↔ 外观设置）', async () => {
    const options = await openOptionsPage(context, extensionId);
    const navItems = options.locator('.nav-item');

    // 切换到外观设置
    await navItems.nth(1).click();
    await options.waitForTimeout(300);
    await expect(options.locator('#tab-appearance')).toHaveClass(/active/);
    await expect(options.locator('#tab-general')).not.toHaveClass(/active/);

    // 切换回连接设置
    await navItems.nth(0).click();
    await options.waitForTimeout(300);
    await expect(options.locator('#tab-general')).toHaveClass(/active/);
    await expect(options.locator('#tab-appearance')).not.toHaveClass(/active/);
    await options.close();
  });

  test('4.7 外观设置 - 主题 radio 卡片选择', async () => {
    const options = await openOptionsPage(context, extensionId);
    await options.locator('.nav-item[data-tab="appearance"]').click();
    await options.waitForTimeout(300);

    // 验证主题卡片存在
    const themeCards = options.locator('.theme-card');
    await expect(themeCards).toHaveCount(3);

    // 获取所有 radio
    const themeRadios = options.locator('input[name="theme"]');
    await expect(themeRadios).toHaveCount(3);

    // 默认 auto 选中
    await expect(themeRadios.nth(0)).toBeChecked();

    // 点击 light
    await themeCards.nth(1).click();
    await options.waitForTimeout(200);
    await expect(themeRadios.nth(1)).toBeChecked();
    await expect(themeRadios.nth(0)).not.toBeChecked();

    // 点击 dark
    await themeCards.nth(2).click();
    await options.waitForTimeout(200);
    await expect(themeRadios.nth(2)).toBeChecked();

    // 点击 auto
    await themeCards.nth(0).click();
    await options.waitForTimeout(200);
    await expect(themeRadios.nth(0)).toBeChecked();
    await options.close();
  });

  test('4.8 外观设置 - 字体大小 slider', async () => {
    const options = await openOptionsPage(context, extensionId);
    await options.locator('.nav-item[data-tab="appearance"]').click();
    await options.waitForTimeout(300);

    const fontSizeSlider = options.locator('#fontSize');
    const fontSizeValue = options.locator('#fontSizeValue');

    // 默认值
    await expect(fontSizeSlider).toBeVisible();
    await expect(fontSizeValue).toBeVisible();
    expect(await fontSizeSlider.inputValue()).toBe('14');
    expect(await fontSizeValue.textContent()).toBe('14px');

    // 调整到 20
    await fontSizeSlider.fill('20');
    await options.waitForTimeout(200);
    expect(await fontSizeValue.textContent()).toBe('20px');

    // 调整到最小 10
    await fontSizeSlider.fill('10');
    await options.waitForTimeout(200);
    expect(await fontSizeValue.textContent()).toBe('10px');

    // 调整到最大 24
    await fontSizeSlider.fill('24');
    await options.waitForTimeout(200);
    expect(await fontSizeValue.textContent()).toBe('24px');
    await options.close();
  });

  test('4.9 保存配置并持久化', async () => {
    const options = await openOptionsPage(context, extensionId);

    // 修改配置
    await options.locator('#apiUrl').fill('https://custom-test.com/v1/chat/completions');
    await options.locator('#apiKey').fill('sk-test-key-12345');
    await options.locator('#model').fill('gpt-4o-test');

    // 切换主题
    await options.locator('.nav-item[data-tab="appearance"]').click();
    await options.waitForTimeout(200);
    await options.locator('.theme-card[data-theme="dark"]').click();
    await options.waitForTimeout(100);
    await options.locator('#fontSize').fill('18');
    await options.waitForTimeout(100);

    // 保存
    await options.locator('#saveBtn').click();
    await options.waitForTimeout(1000);

    // 验证保存成功提示
    const statusText = await options.locator('#saveStatus').textContent();
    expect(statusText.length).toBeGreaterThan(0);
    await options.close();

    // 新开一个 Options 页面验证配置已持久化
    const options2 = await openOptionsPage(context, extensionId);
    expect(await options2.locator('#apiUrl').inputValue()).toBe('https://custom-test.com/v1/chat/completions');
    expect(await options2.locator('#apiKey').inputValue()).toBe('sk-test-key-12345');
    expect(await options2.locator('#model').inputValue()).toBe('gpt-4o-test');

    // 检查外观设置已持久化
    await options2.locator('.nav-item[data-tab="appearance"]').click();
    await options2.waitForTimeout(300);
    await expect(options2.locator('input[name="theme"][value="dark"]')).toBeChecked();
    expect(await options2.locator('#fontSize').inputValue()).toBe('18');
    expect(await options2.locator('#fontSizeValue').textContent()).toBe('18px');
    await options2.close();
  });

  test('4.10 恢复默认设置', async () => {
    const options = await openOptionsPage(context, extensionId);

    // 先修改一些值
    await options.locator('#apiUrl').fill('https://custom.com/api');
    await options.locator('#apiKey').fill('sk-test');
    await options.locator('#model').fill('custom-model');

    // 点击恢复默认
    await options.locator('#resetBtn').click();
    await options.waitForTimeout(1000);

    // 验证恢复
    expect(await options.locator('#apiUrl').inputValue()).toBe('https://opencode.ai/zen/v1/chat/completions');
    expect(await options.locator('#apiKey').inputValue()).toBe('');
    expect(await options.locator('#model').inputValue()).toBe('');

    // 验证预设按钮也恢复激活状态
    await expect(options.locator('.preset-btn').nth(0)).toHaveClass(/active/);
    await options.close();
  });

  test('4.11 保存时验证空 API URL', async () => {
    const options = await openOptionsPage(context, extensionId);
    await options.locator('#apiUrl').fill('');
    await options.locator('#saveBtn').click();
    await options.waitForTimeout(500);
    const statusEl = options.locator('#saveStatus');
    // 应该显示错误提示
    const text = await statusEl.textContent();
    expect(text.length).toBeGreaterThan(0);
    await options.close();
  });

  test('4.12 保存时验证无效 API URL 格式', async () => {
    const options = await openOptionsPage(context, extensionId);
    await options.locator('#apiUrl').fill('not-a-valid-url');
    await options.locator('#saveBtn').click();
    await options.waitForTimeout(500);
    const statusEl = options.locator('#saveStatus');
    const text = await statusEl.textContent();
    expect(text.length).toBeGreaterThan(0);
    await options.close();
  });

  test('4.13 恢复默认后外观设置也重置', async () => {
    const options = await openOptionsPage(context, extensionId);

    // 修改外观设置
    await options.locator('.nav-item[data-tab="appearance"]').click();
    await options.waitForTimeout(200);
    await options.locator('.theme-card[data-theme="dark"]').click();
    await options.waitForTimeout(100);
    await options.locator('#fontSize').fill('20');
    await options.waitForTimeout(100);

    // 恢复默认
    await options.locator('.nav-item[data-tab="general"]').click();
    await options.waitForTimeout(200);
    await options.locator('#resetBtn').click();
    await options.waitForTimeout(1000);

    // 检查外观设置重置
    await options.locator('.nav-item[data-tab="appearance"]').click();
    await options.waitForTimeout(300);
    await expect(options.locator('input[name="theme"][value="auto"]')).toBeChecked();
    expect(await options.locator('#fontSize').inputValue()).toBe('14');
    expect(await options.locator('#fontSizeValue').textContent()).toBe('14px');
    await options.close();
  });
});
