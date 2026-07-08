/**
 * AI 翻译插件 v1.0.2 — 选项页新增功能 E2E 测试
 *
 * 覆盖测试维度：
 *   1. 侧边栏有 5 个导航项，第 5 项文字为「翻译记录」
 *   2. 点击「翻译记录」导航项切换到 history 标签页
 *   3. 连接设置中有「划词行为」卡片，包含 autoTranslate 复选框
 *   4. 连接设置中有「快捷键」卡片，显示 Alt+T / Ctrl+Enter / Esc
 *   5. 自动划译开关可点击选中/取消
 *
 * 运行方式：
 *   npx playwright test tests/v102_e2e.spec.js --config=tests/playwright.config.js
 *   npx playwright test tests/v102_e2e.spec.js --config=tests/playwright.config.js --headed
 */

// @ts-check
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..');

async function launchExtensionContext() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-component-extensions-with-background-pages=false',
    ],
  });

  const context = await browser.newContext({
    serviceWorkers: 'allow',
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  let extensionId = null;
  for (const sw of context.serviceWorkers) {
    const m = sw.url().match(/chrome-extension:\/\/([a-z]+)\//);
    if (m) { extensionId = m[1]; break; }
  }

  return { browser, context, extensionId };
}

test.describe('AI 翻译插件 v1.0.2 — 选项页新增功能 E2E', () => {

  /** @type {import('@playwright/test').Browser} */
  let browser;
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {string} */
  let extId;

  test.beforeAll(async () => {
    const launched = await launchExtensionContext();
    browser = launched.browser;
    context = launched.context;
    extId = launched.extensionId;

    if (!extId) {
      for (const sw of context.serviceWorkers) {
        const m = sw.url().match(/chrome-extension:\/\/([a-z]+)\//);
        if (m) { extId = m[1]; break; }
      }
    }
    console.log(`Extension ID: ${extId}`);
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  async function openOptionsPage() {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/options.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.layout', { state: 'visible' });
    return page;
  }

  // ===================================================================
  // 1. 侧边栏 — 5 个导航项
  // ===================================================================
  test.describe('1. 侧边栏导航 — 5 个导航项', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('有且仅有 5 个导航项', async () => {
      await expect(page.locator('.nav-item')).toHaveCount(5);
    });

    test('导航项文字依次为：连接设置、外观设置、翻译风格、单词本、翻译记录', async () => {
      const navItems = page.locator('.nav-item');
      await expect(navItems.nth(0)).toContainText('连接设置');
      await expect(navItems.nth(1)).toContainText('外观设置');
      await expect(navItems.nth(2)).toContainText('翻译风格');
      await expect(navItems.nth(3)).toContainText('单词本');
      await expect(navItems.nth(4)).toContainText('翻译记录');
    });

    test('第 5 个导航项 data-tab 为 history', async () => {
      await expect(page.locator('.nav-item').nth(4)).toHaveAttribute('data-tab', 'history');
    });

    test('每个导航项均包含 SVG 图标', async () => {
      const navItems = page.locator('.nav-item');
      for (let i = 0; i < 5; i++) {
        await expect(navItems.nth(i).locator('svg')).toBeVisible();
      }
    });
  });

  // ===================================================================
  // 2. 翻译记录 Tab 切换
  // ===================================================================
  test.describe('2. 翻译记录 Tab 切换', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('点击「翻译记录」→ 切换到 history Tab', async () => {
      await page.locator('.nav-item').nth(4).click();
      await expect(page.locator('.nav-item').nth(4)).toHaveClass(/active/);
      await expect(page.locator('#tab-history')).toBeVisible();
      await expect(page.locator('#tab-history')).toHaveClass(/active/);
      await expect(page.locator('#tab-general')).not.toHaveClass(/active/);
    });

    test('翻译记录页面标题和描述文案正确', async () => {
      await expect(page.locator('#tab-history h2')).toHaveText('翻译记录');
      await expect(page.locator('#historyCount')).toBeVisible();
      await expect(page.locator('#historyCount')).toContainText('共 0 条记录（最多 200 条）');
    });

    test('翻译记录工具栏存在：搜索框和清空按钮', async () => {
      await expect(page.locator('#historySearch')).toBeVisible();
      await expect(page.locator('#historySearch')).toHaveAttribute('placeholder', '搜索原文或翻译...');
      await expect(page.locator('#clearHistoryBtn')).toBeVisible();
      await expect(page.locator('#clearHistoryBtn')).toContainText('清空记录');
    });

    test('空状态下显示「还没有翻译记录」', async () => {
      const emptyState = page.locator('#historyEmpty');
      await expect(emptyState).toBeVisible({ timeout: 3000 });
      await expect(emptyState.locator('p')).toHaveText('还没有翻译记录');
      await expect(emptyState.locator('svg')).toBeVisible();
    });

    test('搜索框中输入文字后空状态文案变为「没有匹配的记录」', async () => {
      const searchInput = page.locator('#historySearch');
      const emptyState = page.locator('#historyEmpty');

      await searchInput.fill('不存在的记录xxxx');
      await page.waitForTimeout(300);

      await expect(emptyState).toBeVisible();
      await expect(emptyState.locator('p')).toHaveText('没有匹配的记录');

      await searchInput.fill('');
      await page.waitForTimeout(300);
      await expect(emptyState.locator('p')).toHaveText('还没有翻译记录');
    });

    test('切回连接设置再点单词本，最后点回翻译记录仍然正常', async () => {
      await page.locator('.nav-item').nth(0).click();
      await expect(page.locator('#tab-general')).toHaveClass(/active/);

      await page.locator('.nav-item').nth(3).click();
      await expect(page.locator('#tab-wordbook')).toHaveClass(/active/);

      await page.locator('.nav-item').nth(4).click();
      await expect(page.locator('#tab-history')).toHaveClass(/active/);
      await expect(page.locator('.nav-item').nth(4)).toHaveClass(/active/);
    });
  });

  // ===================================================================
  // 3. 连接设置 — 划词行为卡片
  // ===================================================================
  test.describe('3. 连接设置 — 划词行为', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
      await page.locator('.nav-item').nth(0).click();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('存在「划词行为」卡片', async () => {
      const cards = page.locator('#tab-general .card');
      let found = false;
      for (let i = 0; i < await cards.count(); i++) {
        const label = cards.nth(i).locator('.field-label');
        if ((await label.textContent())?.trim() === '划词行为') {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    test('划词行为卡片包含 autoTranslate 复选框', async () => {
      const card = page.locator('#tab-general .card').filter({ hasText: '划词行为' });
      await expect(card.locator('#autoTranslate')).toBeVisible();
      await expect(card.locator('#autoTranslate')).toHaveAttribute('type', 'checkbox');
    });

    test('复选框标签文字为「选中文本后自动翻译（不显示翻译图标）」', async () => {
      const toggleRow = page.locator('#autoTranslate').locator('..');
      await expect(toggleRow).toContainText('选中文本后自动翻译（不显示翻译图标）');
    });

    test('复选框旁边包含 toggle 样式轨道', async () => {
      const toggleRow = page.locator('#autoTranslate').locator('..');
      await expect(toggleRow.locator('.toggle-track')).toBeVisible();
      await expect(toggleRow.locator('.toggle-track .toggle-knob')).toBeVisible();
    });
  });

  // ===================================================================
  // 4. 连接设置 — 快捷键卡片
  // ===================================================================
  test.describe('4. 连接设置 — 快捷键', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
      await page.locator('.nav-item').nth(0).click();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('存在「快捷键」卡片', async () => {
      const cards = page.locator('#tab-general .card');
      let found = false;
      for (let i = 0; i < await cards.count(); i++) {
        const label = cards.nth(i).locator('.field-label');
        if ((await label.textContent())?.trim() === '快捷键') {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    test('快捷键卡片标题为「快捷键」', async () => {
      const card = page.locator('#tab-general .card').filter({ hasText: '快捷键' });
      await expect(card.locator('.field-label')).toContainText('快捷键');
    });

    test('快捷键卡片包含 Alt+T 组合键', async () => {
      const card = page.locator('#tab-general .card').filter({ hasText: '快捷键' });
      const shortcutRows = card.locator('.shortcut-row');
      await expect(shortcutRows.nth(0)).toBeVisible();
      await expect(shortcutRows.nth(0).locator('kbd').nth(0)).toHaveText('Alt');
      await expect(shortcutRows.nth(0).locator('kbd').nth(1)).toHaveText('T');
      await expect(shortcutRows.nth(0)).toContainText('翻译当前选中的文本');
    });

    test('快捷键卡片包含 Ctrl+Enter 组合键', async () => {
      const card = page.locator('#tab-general .card').filter({ hasText: '快捷键' });
      const shortcutRows = card.locator('.shortcut-row');
      await expect(shortcutRows.nth(1)).toBeVisible();
      await expect(shortcutRows.nth(1).locator('kbd').nth(0)).toHaveText('Ctrl');
      await expect(shortcutRows.nth(1).locator('kbd').nth(1)).toHaveText('Enter');
      await expect(shortcutRows.nth(1)).toContainText('在翻译面板中快速翻译');
    });

    test('快捷键卡片包含 Esc', async () => {
      const card = page.locator('#tab-general .card').filter({ hasText: '快捷键' });
      const shortcutRows = card.locator('.shortcut-row');
      await expect(shortcutRows.nth(2)).toBeVisible();
      await expect(shortcutRows.nth(2).locator('kbd')).toHaveText('Esc');
      await expect(shortcutRows.nth(2)).toContainText('关闭翻译弹窗');
    });

    test('快捷键卡片有且仅有 3 行快捷键', async () => {
      const card = page.locator('#tab-general .card').filter({ hasText: '快捷键' });
      await expect(card.locator('.shortcut-row')).toHaveCount(3);
    });

    test('每行快捷键均包含 SVG 图标（卡片图标）', async () => {
      const card = page.locator('#tab-general .card').filter({ hasText: '快捷键' });
      await expect(card.locator('.card-icon svg')).toBeVisible();
    });
  });

  // ===================================================================
  // 5. 自动划译开关交互
  // ===================================================================
  test.describe('5. 自动划译开关交互', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
      await page.locator('.nav-item').nth(0).click();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('autoTranslate 复选框默认未选中', async () => {
      const checkbox = page.locator('#autoTranslate');
      await expect(checkbox).not.toBeChecked();
    });

    test('点击复选框可选中（勾选）', async () => {
      const checkbox = page.locator('#autoTranslate');
      await checkbox.check({ force: true });
      await expect(checkbox).toBeChecked();
    });

    test('再次点击可取消选中', async () => {
      const checkbox = page.locator('#autoTranslate');
      await checkbox.uncheck({ force: true });
      await expect(checkbox).not.toBeChecked();
    });

    test('快速连续点选两次最终状态为未选中', async () => {
      const checkbox = page.locator('#autoTranslate');
      await checkbox.check({ force: true });
      await expect(checkbox).toBeChecked();
      await checkbox.uncheck({ force: true });
      await expect(checkbox).not.toBeChecked();
      await checkbox.check({ force: true });
      await expect(checkbox).toBeChecked();
      await checkbox.uncheck({ force: true });
      await expect(checkbox).not.toBeChecked();
    });

    test('点击关联的 label 文字也能切换复选框', async () => {
      const checkbox = page.locator('#autoTranslate');
      const label = checkbox.locator('..');

      await checkbox.uncheck({ force: true });
      await expect(checkbox).not.toBeChecked();

      // 点击 label 中的文本部分触发切换
      await label.locator('span').filter({ hasText: '自动翻译' }).click();
      await expect(checkbox).toBeChecked();

      await label.locator('span').filter({ hasText: '自动翻译' }).click();
      await expect(checkbox).not.toBeChecked();
    });

    test('autoTranslate 值与 JS 中 loadConfig 的默认值一致（false）', async () => {
      const checkbox = page.locator('#autoTranslate');
      await checkbox.uncheck({ force: true });
      await expect(checkbox).not.toBeChecked();

      // 通过 page.evaluate 验证 JS 内存中的默认配置
      const defaultValue = await page.evaluate(() => typeof DEFAULT_CONFIG !== 'undefined' ? DEFAULT_CONFIG.autoTranslate : 'undefined');
      expect(defaultValue).toBe(false);
    });

    test('保存时 autoTranslate 状态会被包含在配置中（验证 checkbox name）', async () => {
      const checkbox = page.locator('#autoTranslate');
      await checkbox.check({ force: true });
      await expect(checkbox).toBeChecked();

      const value = await page.evaluate(() => {
        const cb = document.getElementById('autoTranslate');
        return cb ? cb.checked : null;
      });
      expect(value).toBe(true);

      await checkbox.uncheck({ force: true });
      const valueAfter = await page.evaluate(() => {
        const cb = document.getElementById('autoTranslate');
        return cb ? cb.checked : null;
      });
      expect(valueAfter).toBe(false);
    });
  });

  // ===================================================================
  // 6. 外观设置 — 主题卡片 active 类
  // ===================================================================
  test.describe('6. 主题卡片 active 类', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
      await page.locator('.nav-item').nth(1).click();
      await expect(page.locator('#tab-appearance')).toHaveClass(/active/);
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('「跟随系统」卡片默认有 active class 且 radio 为 checked', async () => {
      const autoCard = page.locator('.theme-card[data-theme="auto"]');
      await expect(autoCard).toHaveClass(/active/);
      await expect(autoCard.locator('input[type="radio"]')).toBeChecked();
    });

    test('「浅色」和「深色」卡片默认没有 active class', async () => {
      await expect(page.locator('.theme-card[data-theme="light"]')).not.toHaveClass(/active/);
      await expect(page.locator('.theme-card[data-theme="dark"]')).not.toHaveClass(/active/);
    });

    test('点击「深色」卡片后 active 状态正确转移', async () => {
      const darkCard = page.locator('.theme-card[data-theme="dark"]');
      const autoCard = page.locator('.theme-card[data-theme="auto"]');

      await darkCard.click();
      await expect(darkCard).toHaveClass(/active/);
      await expect(darkCard.locator('input[type="radio"]')).toBeChecked();
      await expect(autoCard).not.toHaveClass(/active/);
      await expect(autoCard.locator('input[type="radio"]')).not.toBeChecked();
    });

    test('点击「浅色」卡片后 active 状态正确转移', async () => {
      const lightCard = page.locator('.theme-card[data-theme="light"]');
      const darkCard = page.locator('.theme-card[data-theme="dark"]');

      await lightCard.click();
      await expect(lightCard).toHaveClass(/active/);
      await expect(lightCard.locator('input[type="radio"]')).toBeChecked();
      await expect(darkCard).not.toHaveClass(/active/);
      await expect(darkCard.locator('input[type="radio"]')).not.toBeChecked();
    });
  });
});

// ===================================================================
// 7. popup.html 中所有 __MSG_ 引用对应的 i18n key 都存在
// ===================================================================
test.describe('7. popup.html 中 __MSG_ 引用的 i18n key 验证', () => {

  const fs = require('fs');
  const popupHtml = path.resolve(__dirname, '..', 'popup.html');
  const enMessages = path.resolve(__dirname, '..', '_locales', 'en', 'messages.json');
  const zhMessages = path.resolve(__dirname, '..', '_locales', 'zh_CN', 'messages.json');

  test('所有 __MSG_xxx__ 引用的 key 在 en 和 zh_CN 的 messages.json 中都存在', () => {
    const html = fs.readFileSync(popupHtml, 'utf-8');
    const matches = html.match(/__MSG_(\w+)__/g);
    const keys = [...new Set(matches.map(m => m.replace(/__MSG_|__/g, '')))];

    console.log(`Found ${keys.length} unique i18n keys in popup.html:`, keys);

    const en = JSON.parse(fs.readFileSync(enMessages, 'utf-8'));
    const zh = JSON.parse(fs.readFileSync(zhMessages, 'utf-8'));

    const missingEn = keys.filter(k => !en[k]);
    const missingZh = keys.filter(k => !zh[k]);

    if (missingEn.length) console.log('Missing in en/messages.json:', missingEn);
    if (missingZh.length) console.log('Missing in zh_CN/messages.json:', missingZh);

    expect(missingEn).toEqual([]);
    expect(missingZh).toEqual([]);
  });
});

// ===================================================================
// 8. content.js pointerup 处理器在右键点击时提前返回
// ===================================================================
test.describe('8. content.js pointerup 处理器 — 右键点击提前返回', () => {

  const fs = require('fs');
  const contentJs = path.resolve(__dirname, '..', 'content.js');

  test('handler 第一行（声明后任何其他语句之前）是 event.button === 2 return', () => {
    const code = fs.readFileSync(contentJs, 'utf-8');

    const match = code.match(/document\.addEventListener\(\s*['"]pointerup['"]\s*,\s*\(?\s*event\s*\)?\s*=>\s*\{/);
    expect(match).not.toBeNull();

    const startIndex = match.index + match[0].length;
    const body = code.slice(startIndex);
    const firstStatement = body.replace(/^\s*\n/, '').match(/^\s*if\s*\(event\.button\s*===\s*2\s*\)\s*return\s*;?\s*/);
    expect(firstStatement).not.toBeNull();
  });

  test('handler 中包含 event.button === 2 的检查', () => {
    const code = fs.readFileSync(contentJs, 'utf-8');

    const match = code.match(/document\.addEventListener\(\s*['"]pointerup['"]\s*,\s*\(?\s*event\s*\)?\s*=>\s*\{([\s\S]*?)\}\);/);
    expect(match).not.toBeNull();

    const handlerBody = match[1];
    expect(handlerBody).toContain('event.button === 2');
  });
});

// ===================================================================
// 9. 翻译记录单条删除功能
// ===================================================================
test.describe('9. 翻译记录单条删除功能', () => {

  const fs = require('fs');
  const backgroundJs = path.resolve(__dirname, '..', 'background.js');
  const optionsJs = path.resolve(__dirname, '..', 'options.js');

  test('9.1 background.js 中存在 async function deleteHistoryEntry', () => {
    const code = fs.readFileSync(backgroundJs, 'utf-8');
    expect(code.match(/async function deleteHistoryEntry/)).not.toBeNull();
    const funcMatch = code.match(/async function deleteHistoryEntry\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(funcMatch).not.toBeNull();
    const funcBody = funcMatch[1];
    expect(funcBody).toMatch(/filter\s*\(\s*item\s*=>\s*item\.id\s*(?:!==|!=\s*)\s*id\s*\)/);
  });

  test('9.2 case \'deleteHistoryEntry\' 在 switch 中注册', () => {
    const code = fs.readFileSync(backgroundJs, 'utf-8');
    expect(code).toContain("case 'deleteHistoryEntry':");
  });

  test('9.3 options.js renderHistory 中每个历史项有删除按钮', () => {
    const code = fs.readFileSync(optionsJs, 'utf-8');
    const funcStart = code.indexOf('function renderHistory');
    expect(funcStart).not.toBe(-1);
    const bodyAfter = code.slice(funcStart);
    const braceMatch = bodyAfter.match(/function renderHistory\s*\([^)]*\)\s*\{/);
    expect(braceMatch).not.toBeNull();
    const bodyStart = braceMatch.index + braceMatch[0].length;
    const remaining = bodyAfter.slice(bodyStart);
    let depth = 1;
    let endIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] === '{') depth++;
      else if (remaining[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = remaining.slice(0, endIdx);
    expect(funcBody).toMatch(/delBtn/);
    expect(funcBody).toMatch(/wordbook-item-del/);
    expect(funcBody).toContain("action: 'deleteHistoryEntry'");
    expect(funcBody).toContain('id: item.id');
  });
});

// ===================================================================
// 10. content.js 源代码点击复制 + hideTranslatePopup 清理
// ===================================================================
test.describe('10. content.js 源代码点击复制 + hideTranslatePopup 清理', () => {

  const fs = require('fs');
  const contentJs = path.resolve(__dirname, '..', 'content.js');

  test('10.1 sourceDiv 点击复制功能', () => {
    const code = fs.readFileSync(contentJs, 'utf-8');

    const sourceDivMatch = code.match(/sourceDiv\.addEventListener\(\s*['"]click['"]\s*,\s*async\s*\(\)\s*=>\s*\{/);
    expect(sourceDivMatch).not.toBeNull();

    const startIdx = sourceDivMatch.index + sourceDivMatch[0].length;
    const remaining = code.slice(startIdx);

    let depth = 0;
    let endIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] === '{') depth++;
      else if (remaining[i] === '}') { depth--; if (depth === -1) { endIdx = i; break; } }
    }
    const handlerBody = remaining.slice(0, endIdx);

    expect(handlerBody).toContain('navigator.clipboard.writeText(text)');
    expect(handlerBody).toContain("execCommand('copy')");
    expect(handlerBody).toContain('let copied = false');
    expect(handlerBody).toMatch(/if\s*\(\s*copied\s*\)/);
    expect(handlerBody).toContain('#22c55e');
  });

  test('10.2 hideTranslatePopup 清理 iconHideTimeout', () => {
    const code = fs.readFileSync(contentJs, 'utf-8');

    const funcMatch = code.match(/function hideTranslatePopup\s*\(\s*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    const body = code.slice(startIdx);

    const firstStatement = body.match(/^\s*if\s*\(iconHideTimeout\)\s*\{\s*clearTimeout\(iconHideTimeout\)/);
    expect(firstStatement).not.toBeNull();
  });
});

// ===================================================================
// 11. content.js getSelectedText + popup.js loadSelectedText
// ===================================================================
test.describe('11. 弹窗自动加载选中文本功能', () => {

  const fs = require('fs');
  const contentJs = path.resolve(__dirname, '..', 'content.js');
  const popupJs = path.resolve(__dirname, '..', 'popup.js');

  test('11.1 content.js onMessage listener 包含 getSelectedText 分支', () => {
    const code = fs.readFileSync(contentJs, 'utf-8');

    const match = code.match(/chrome\.runtime\.onMessage\.addListener\s*\(\s*\(?\s*message\s*(?:,\s*sender\s*)?(?:,\s*sendResponse\s*)?\)?\s*=>\s*\{/);
    expect(match).not.toBeNull();

    const startIdx = match.index + match[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const handlerBody = code.slice(startIdx, endIdx);

    expect(handlerBody).toContain("message.action === 'getSelectedText'");
    expect(handlerBody).toContain('window.getSelection()');
    expect(handlerBody).toMatch(/sendResponse\s*\(\s*\{\s*text\s*:/);
  });

  test('11.2 popup.js loadSelectedText 在全局作用域定义', () => {
    const code = fs.readFileSync(popupJs, 'utf-8');
    const mainMatch = code.match(/document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]\s*,/);
    expect(mainMatch).not.toBeNull();

    const funcMatch = code.match(/async function loadSelectedText/);
    expect(funcMatch).not.toBeNull();

    const beforeDomReadyEnd = code.match(/}\);\s*$/);
    expect(beforeDomReadyEnd).not.toBeNull();

    expect(funcMatch.index).toBeGreaterThan(mainMatch.index);
    expect(funcMatch.index).toBeGreaterThan(beforeDomReadyEnd.index);
  });

  test('11.3 loadSelectedText 使用 chrome.tabs.query', () => {
    const code = fs.readFileSync(popupJs, 'utf-8');

    const funcMatch = code.match(/async function loadSelectedText\s*\(\s*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    expect(funcBody).toContain('chrome.tabs.query');
    expect(funcBody).toContain('chrome.tabs.sendMessage');
    expect(funcBody).toContain("document.getElementById('popupInputText')");
    expect(funcBody).toContain('try');
    expect(funcBody).toContain('catch');
  });
});

// ===================================================================
// 12. 单词本重复检测功能 — addWordToBook 源码分析
// ===================================================================
test.describe('12. 单词本重复检测功能', () => {

  const fs = require('fs');
  const backgroundJs = path.resolve(__dirname, '..', 'background.js');

  test('12.1 addWordToBook 包含 findIndex 调用', () => {
    const code = fs.readFileSync(backgroundJs, 'utf-8');

    const funcMatch = code.match(/async function addWordToBook\s*\([^)]*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    expect(funcBody).toContain('.findIndex(');
  });

  test('12.2 addWordToBook 存在 existingIndex !== -1 的分支逻辑', () => {
    const code = fs.readFileSync(backgroundJs, 'utf-8');

    const funcMatch = code.match(/async function addWordToBook\s*\([^)]*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    expect(funcBody).toMatch(/existingIndex\s*(?:!==|>=)\s*-1/);
  });

  test('12.3 重复分支中存在 splice 和 unshift', () => {
    const code = fs.readFileSync(backgroundJs, 'utf-8');

    const funcMatch = code.match(/async function addWordToBook\s*\([^)]*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    const ifMatch = funcBody.match(/if\s*\(existingIndex\s*(?:!==|>=)\s*-1\)\s*\{([\s\S]*?)\}\s*else\s*\{/);
    expect(ifMatch).not.toBeNull();
    const ifBody = ifMatch[1];

    expect(ifBody).toContain('.splice(');
    expect(ifBody).toContain('.unshift(');
  });

  test('12.4 重复分支中没有覆盖 id 的操作', () => {
    const code = fs.readFileSync(backgroundJs, 'utf-8');

    const funcMatch = code.match(/async function addWordToBook\s*\([^)]*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    const ifMatch = funcBody.match(/if\s*\(existingIndex\s*(?:!==|>=)\s*-1\)\s*\{([\s\S]*?)\}\s*else\s*\{/);
    expect(ifMatch).not.toBeNull();
    const ifBody = ifMatch[1];

    expect(ifBody).not.toMatch(/item\.id\s*=/);
    expect(ifBody).not.toMatch(/\.id\s*=\s*Date\.now/);
  });

  test('12.5 重复分支中有 item.translation = 和 .timestamp = Date.now()', () => {
    const code = fs.readFileSync(backgroundJs, 'utf-8');

    const funcMatch = code.match(/async function addWordToBook\s*\([^)]*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    const ifMatch = funcBody.match(/if\s*\(existingIndex\s*(?:!==|>=)\s*-1\)\s*\{([\s\S]*?)\}\s*else\s*\{/);
    expect(ifMatch).not.toBeNull();
    const ifBody = ifMatch[1];

    expect(ifBody).toContain('.translation = ');
    expect(ifBody).toContain('.timestamp = Date.now()');
  });
});

// ===================================================================
// 13. saveConfig 函数的 try-catch 完整包裹
// ===================================================================
test.describe('13. saveConfig 函数的 try-catch 完整包裹', () => {

  const fs = require('fs');
  const optionsJs = path.resolve(__dirname, '..', 'options.js');

  test('13.1 saveConfig 函数开头是 try {', () => {
    const code = fs.readFileSync(optionsJs, 'utf-8');

    const funcMatch = code.match(/async function saveConfig\s*\(\s*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    const body = code.slice(startIdx);

    const firstStatement = body.match(/^\s*try\s*\{/);
    expect(firstStatement).not.toBeNull();

    expect(code).toContain('catch (err)');
  });

  test('13.2 所有 await 都在 try 块内', () => {
    const code = fs.readFileSync(optionsJs, 'utf-8');

    // Extract saveConfig function body
    const funcMatch = code.match(/async function saveConfig\s*\(\s*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    // Find the try block boundaries
    const tryMatch = funcBody.match(/try\s*\{/);
    expect(tryMatch).not.toBeNull();
    const tryStartIdx = tryMatch.index + tryMatch[0].length;

    let tryDepth = 1;
    let tryEndIdx = 0;
    for (let i = tryStartIdx; i < funcBody.length; i++) {
      if (funcBody[i] === '{') tryDepth++;
      else if (funcBody[i] === '}') { tryDepth--; if (tryDepth === 0) { tryEndIdx = i; break; } }
    }
    const tryBody = funcBody.slice(tryStartIdx, tryEndIdx);

    // Find all await expressions in the whole function body
    const awaitMatches = funcBody.match(/\bawait\b/g);
    expect(awaitMatches).not.toBeNull();

    // Each await's position should be within the try body
    let searchPos = 0;
    while (true) {
      const awaitIdx = funcBody.indexOf('await', searchPos);
      if (awaitIdx === -1) break;
      const awaitInFuncOffset = awaitIdx;
      expect(awaitInFuncOffset).toBeGreaterThanOrEqual(tryStartIdx);
      expect(awaitInFuncOffset).toBeLessThan(tryStartIdx + tryBody.length);
      searchPos = awaitIdx + 5;
    }
  });

  test('13.3 catch 块使用 showStatus 显示错误', () => {
    const code = fs.readFileSync(optionsJs, 'utf-8');

    // Extract saveConfig function body
    const funcMatch = code.match(/async function saveConfig\s*\(\s*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    // Find catch block
    const catchMatch = funcBody.match(/catch\s*\(err\)\s*\{/);
    expect(catchMatch).not.toBeNull();

    const catchStartIdx = catchMatch.index + catchMatch[0].length;
    let catchDepth = 1;
    let catchEndIdx = 0;
    for (let i = catchStartIdx; i < funcBody.length; i++) {
      if (funcBody[i] === '{') catchDepth++;
      else if (funcBody[i] === '}') { catchDepth--; if (catchDepth === 0) { catchEndIdx = i; break; } }
    }
    const catchBody = funcBody.slice(catchStartIdx, catchEndIdx);

    expect(catchBody).toContain("showStatus('保存失败: ' + err.message, 'error')");
  });
});

// ===================================================================
// 14. 翻译记录导出功能
// ===================================================================
test.describe('14. 翻译记录导出功能', () => {

  const fs = require('fs');
  const optionsHtml = path.resolve(__dirname, '..', 'options.html');
  const optionsJsPath = path.resolve(__dirname, '..', 'options.js');

  test('14.1 options.html 中存在 exportHistoryBtn 导出按钮', () => {
    const html = fs.readFileSync(optionsHtml, 'utf-8');

    const btnMatch = html.match(/<button[^>]*id="exportHistoryBtn"[^>]*>/);
    expect(btnMatch).not.toBeNull();

    const btnHtml = btnMatch[0];
    expect(btnHtml).toContain('class="btn-wordbook-export"');

    const afterBtn = html.slice(btnMatch.index + btnMatch[0].length);
    expect(afterBtn).toMatch(/<svg[\s\S]*?<\/svg>\s*\n\s*导出/);
  });

  test('14.2 options.js 中 exportHistoryBtn 点击处理', () => {
    const code = fs.readFileSync(optionsJsPath, 'utf-8');

    expect(code).toContain("document.getElementById('exportHistoryBtn')");
    expect(code).toContain("exportHistoryBtn.addEventListener('click',");

    const match = code.match(/exportHistoryBtn\.addEventListener\(\s*'click'\s*,\s*async\s*\(\)\s*=>\s*\{/);
    expect(match).not.toBeNull();

    const startIdx = match.index + match[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const handlerBody = code.slice(startIdx, endIdx);

    expect(handlerBody).toContain("action: 'getHistory'");
    expect(handlerBody).toContain('JSON.stringify');
    expect(handlerBody).toContain('Blob');
    expect(handlerBody).toContain("'history_'");
    expect(handlerBody).toContain('new Date()');
  });
});

// ===================================================================
// 15. content.css popup-source 可点击样式
// ===================================================================
test.describe('15. content.css popup-source 可点击样式', () => {

  const fs = require('fs');
  const contentCss = path.resolve(__dirname, '..', 'content.css');

  test('15.1 .popup-source 选择器块包含 cursor: pointer', () => {
    const css = fs.readFileSync(contentCss, 'utf-8');

    const blockMatch = css.match(/#ai-translate-popup\s*\.popup-source\s*\{([^}]*)\}/);
    expect(blockMatch).not.toBeNull();

    const block = blockMatch[1];
    expect(block).toContain('cursor: pointer');
  });

  test('15.2 .popup-source 选择器块包含 transition: color .3s ease', () => {
    const css = fs.readFileSync(contentCss, 'utf-8');

    const blockMatch = css.match(/#ai-translate-popup\s*\.popup-source\s*\{([^}]*)\}/);
    expect(blockMatch).not.toBeNull();

    const block = blockMatch[1];
    expect(block).toContain('transition: color .3s ease');
  });
});

// ===================================================================
// 16. content.js autoTranslate 跳过可编辑区域
// ===================================================================
test.describe('16. content.js autoTranslate 跳过可编辑区域', () => {

  const fs = require('fs');
  const contentJs = path.resolve(__dirname, '..', 'content.js');

  test('16.1 pointerup 处理器中包含 inEditable 声明', () => {
    const code = fs.readFileSync(contentJs, 'utf-8');

    const match = code.match(/document\.addEventListener\(\s*['"]pointerup['"]\s*,\s*\(?\s*event\s*\)?\s*=>\s*\{/);
    expect(match).not.toBeNull();

    const startIndex = match.index + match[0].length;
    const body = code.slice(startIndex);

    expect(body).toContain("inEditable = event.target.closest('input, textarea, [contenteditable]')");

    const textIdx = body.indexOf('const text = ');
    const inEditableIdx = body.indexOf("inEditable = event.target.closest");
    expect(inEditableIdx).toBeGreaterThan(textIdx);
  });

  test('16.2 autoTranslate 条件增加了 !inEditable', () => {
    const code = fs.readFileSync(contentJs, 'utf-8');

    const match = code.match(/document\.addEventListener\(\s*['"]pointerup['"]\s*,\s*\(?\s*event\s*\)?\s*=>\s*\{/);
    expect(match).not.toBeNull();

    const startIndex = match.index + match[0].length;
    const body = code.slice(startIndex);

    expect(body).toMatch(/config\.autoTranslate\s*&&\s*!inEditable/);

    const autoTranslateMatch = body.match(/if\s*\(config\.autoTranslate\s*&&\s*!inEditable\)\s*\{[\s\S]*?showTranslatePopup\(text\)[\s\S]*?return;\s*\}/);
    expect(autoTranslateMatch).not.toBeNull();
  });

  test('16.3 可编辑区域仍显示翻译图标', () => {
    const code = fs.readFileSync(contentJs, 'utf-8');

    const match = code.match(/document\.addEventListener\(\s*['"]pointerup['"]\s*,\s*\(?\s*event\s*\)?\s*=>\s*\{/);
    expect(match).not.toBeNull();

    const startIndex = match.index + match[0].length;
    const body = code.slice(startIndex);

    const autoTranslateIfMatch = body.match(/if\s*\(config\.autoTranslate\s*&&\s*!inEditable\)\s*\{[\s\S]*?\}\s*/);
    expect(autoTranslateIfMatch).not.toBeNull();

    const afterAutoTranslate = body.slice(autoTranslateIfMatch.index + autoTranslateIfMatch[0].length);
    expect(afterAutoTranslate).toMatch(/showTranslateIcon\(rect\)/);
  });
});

// ===================================================================
// 17. popup Ctrl+Enter 快捷键提示
// ===================================================================
test.describe('17. popup Ctrl+Enter 快捷键提示', () => {

  const fs = require('fs');
  const popupHtml = path.resolve(__dirname, '..', 'popup.html');
  const popupCss = path.resolve(__dirname, '..', 'popup.css');

  test('17.1 popup.html 中存在 .popup-shortcut-hint 且包含 Ctrl+Enter', () => {
    const html = fs.readFileSync(popupHtml, 'utf-8');

    const elMatch = html.match(/<div class="popup-shortcut-hint">/);
    expect(elMatch).not.toBeNull();

    const startIdx = elMatch.index + elMatch[0].length;
    const afterHint = html.slice(startIdx);
    const endBracket = afterHint.indexOf('</div>');
    const content = afterHint.slice(0, endBracket);

    expect(content).toContain('Ctrl+Enter');
  });

  test('17.2 popup.css 中存在 .popup-shortcut-hint 且包含 font-size: 11px 和 text-align: right', () => {
    const css = fs.readFileSync(popupCss, 'utf-8');

    const blockMatch = css.match(/\.popup-shortcut-hint\s*\{([^}]*)\}/);
    expect(blockMatch).not.toBeNull();

    const block = blockMatch[1];
    expect(block).toContain('font-size: 11px');
    expect(block).toContain('text-align: right');
  });
});

// ===================================================================
// 18. popup textarea 自动缩放
// ===================================================================
test.describe('18. popup textarea 自动缩放', () => {

  const fs = require('fs');
  const popupJs = path.resolve(__dirname, '..', 'popup.js');

  test('18.1 input 事件 autoResize 包含 style.height = auto 和 Math.min', () => {
    const code = fs.readFileSync(popupJs, 'utf-8');

    const autoResizeMatch = code.match(/const autoResize\s*=\s*\(\s*\)\s*=>\s*\{/);
    expect(autoResizeMatch).not.toBeNull();

    const startIdx = autoResizeMatch.index + autoResizeMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const fnBody = code.slice(startIdx, endIdx);

    expect(fnBody).toContain("inputText.style.height = 'auto'");
    expect(fnBody).toContain('Math.min(inputText.scrollHeight, 200)');

    const addEventListenerMatch = code.match(/inputText\.addEventListener\(\s*['"]input['"]\s*,\s*autoResize\s*\)/);
    expect(addEventListenerMatch).not.toBeNull();
  });

  test('18.2 loadSelectedText 中 el.style.height = auto 和 Math.min', () => {
    const code = fs.readFileSync(popupJs, 'utf-8');

    const funcMatch = code.match(/async function loadSelectedText\s*\(\s*\)\s*\{/);
    expect(funcMatch).not.toBeNull();

    const startIdx = funcMatch.index + funcMatch[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const funcBody = code.slice(startIdx, endIdx);

    expect(funcBody).toContain("el.style.height = 'auto'");
    expect(funcBody).toContain('Math.min(el.scrollHeight, 200)');
  });

  test('18.3 clearBtn click handler 中重置 inputText.style.height', () => {
    const code = fs.readFileSync(popupJs, 'utf-8');

    const match = code.match(/clearBtn\.addEventListener\(\s*'click'\s*,\s*\(\s*\)\s*=>\s*\{/);
    expect(match).not.toBeNull();

    const startIdx = match.index + match[0].length;
    let depth = 1;
    let endIdx = 0;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const handlerBody = code.slice(startIdx, endIdx);

    expect(handlerBody).toContain("inputText.style.height = 'auto'");
  });
});

// ===================================================================
// 19. options.css 暗色模式样式覆盖
// ===================================================================
test.describe('19. options.css 暗色模式样式覆盖', () => {

  const fs = require('fs');
  const optionsCss = path.resolve(__dirname, '..', 'options.css');

  test('19.1 @media (prefers-color-scheme: dark) 块存在', () => {
    const css = fs.readFileSync(optionsCss, 'utf-8');
    const blockMatch = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?)\}/);
    expect(blockMatch).not.toBeNull();
  });

  test('19.2 .wordbook-item-del:hover 包含 background: #3b1a1a', () => {
    const css = fs.readFileSync(optionsCss, 'utf-8');
    const blockMatch = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?)\}/);
    expect(blockMatch).not.toBeNull();

    const darkBlock = blockMatch[1];
    expect(darkBlock).toMatch(/\.wordbook-item-del\s*:\s*hover\s*\{[^}]*background:\s*#3b1a1a/);
  });

  test('19.3 .btn-wordbook-clear:hover 包含 background: #3b1a1a 或 border-color: #ef4444', () => {
    const css = fs.readFileSync(optionsCss, 'utf-8');
    const blockMatch = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?)\}/);
    expect(blockMatch).not.toBeNull();

    const darkBlock = blockMatch[1];
    const btnMatch = darkBlock.match(/\.btn-wordbook-clear\s*:\s*hover\s*\{([^}]*)\}/);
    expect(btnMatch).not.toBeNull();

    const btnBlock = btnMatch[1];
    const hasBg = btnBlock.includes('background: #3b1a1a');
    const hasBorder = btnBlock.includes('border-color: #ef4444');
    expect(hasBg || hasBorder).toBe(true);
  });
});
