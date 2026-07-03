/**
 * AI 翻译插件 v1.0.1 — 选项页 E2E 测试
 *
 * 覆盖测试维度：
 *   1. 页面加载：标题、结构
 *   2. 侧边栏导航：4 个标签页文字正确性
 *   3. Tab 切换：点击导航项正确切换内容面板
 *   4. 连接设置 Tab：API 地址输入框、6 个服务商预设按钮
 *   5. 外观设置 Tab：3 个主题卡片、字体大小滑块
 *   6. 翻译风格 Tab：6 个风格预设卡片 → 填充 textarea
 *   7. 单词本 Tab：空状态文字
 *
 * 运行方式：
 *   npx playwright test tests/options_e2e.spec.js --config=tests/playwright.config.js
 *   npx playwright test tests/options_e2e.spec.js --config=tests/playwright.config.js --headed
 */

// @ts-check
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..');

// ——————————————————————————————————————————————————————
// Helper: 启动浏览器并加载解压扩展，返回 extensionId
// ——————————————————————————————————————————————————————
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

  // 从 Service Worker URL 中提取 extension ID
  let extensionId = null;
  for (const sw of context.serviceWorkers) {
    const m = sw.url().match(/chrome-extension:\/\/([a-z]+)\//);
    if (m) { extensionId = m[1]; break; }
  }

  return { browser, context, extensionId };
}

// ——————————————————————————————————————————————————————
// 测试套件
// ——————————————————————————————————————————————————————
test.describe('AI 翻译插件 v1.0.1 — 选项页 E2E', () => {

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

    // 确保拿到了扩展 ID
    if (!extId) {
      // 兜底：从 Service Worker URL 解析
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

  // ————————————————————————————————————————————————
  // 通用：打开选项页的辅助方法
  // ————————————————————————————————————————————————
  async function openOptionsPage() {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/options.html`);
    await page.waitForLoadState('networkidle');
    // 等待页面完全渲染
    await page.waitForSelector('.layout', { state: 'visible' });
    return page;
  }

  // ===================================================================
  // 1. 页面加载测试
  // ===================================================================
  test.describe('1. 页面加载', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('标题应为"设置"', async () => {
      await expect(page).toHaveTitle('设置');
    });

    test('页面结构完整：存在 sidebar 和 main 区域', async () => {
      await expect(page.locator('.sidebar')).toBeVisible();
      await expect(page.locator('.main')).toBeVisible();
    });

    test('侧边栏头部显示"AI 翻译助手"', async () => {
      const header = page.locator('.sidebar-header');
      await expect(header).toBeVisible();
      await expect(header).toContainText('AI 翻译助手');
    });

    test('底部显示版本号 v1.0.1', async () => {
      await expect(page.locator('.version')).toHaveText('v1.0.1');
    });

    test('默认选中第一个标签页（连接设置）', async () => {
      const navItems = page.locator('.nav-item');
      await expect(navItems.nth(0)).toHaveClass(/active/);
      await expect(page.locator('#tab-general')).toHaveClass(/active/);
    });
  });

  // ===================================================================
  // 2. 侧边栏导航 — 4 个导航项文字验证
  // ===================================================================
  test.describe('2. 侧边栏导航文字', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('有且仅有 4 个导航项', async () => {
      await expect(page.locator('.nav-item')).toHaveCount(4);
    });

    test('导航项文字依次为：连接设置、外观设置、翻译风格、单词本', async () => {
      const navItems = page.locator('.nav-item');
      await expect(navItems.nth(0)).toContainText('连接设置');
      await expect(navItems.nth(1)).toContainText('外观设置');
      await expect(navItems.nth(2)).toContainText('翻译风格');
      await expect(navItems.nth(3)).toContainText('单词本');
    });

    test('每个导航项均包含 SVG 图标', async () => {
      const navItems = page.locator('.nav-item');
      for (let i = 0; i < 4; i++) {
        await expect(navItems.nth(i).locator('svg')).toBeVisible();
      }
    });
  });

  // ===================================================================
  // 3. Tab 切换测试
  // ===================================================================
  test.describe('3. Tab 切换', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('点击"外观设置"→ 切换到外观 Tab', async () => {
      await page.locator('.nav-item').nth(1).click();
      // 导航项高亮
      await expect(page.locator('.nav-item').nth(1)).toHaveClass(/active/);
      // 对应面板显示
      await expect(page.locator('#tab-appearance')).toBeVisible();
      await expect(page.locator('#tab-appearance')).toHaveClass(/active/);
      // 其他面板隐藏
      await expect(page.locator('#tab-general')).not.toHaveClass(/active/);
    });

    test('点击"翻译风格"→ 切换到风格 Tab', async () => {
      await page.locator('.nav-item').nth(2).click();
      await expect(page.locator('.nav-item').nth(2)).toHaveClass(/active/);
      await expect(page.locator('#tab-style')).toBeVisible();
      await expect(page.locator('#tab-style')).toHaveClass(/active/);
    });

    test('点击"单词本"→ 切换到单词本 Tab', async () => {
      await page.locator('.nav-item').nth(3).click();
      await expect(page.locator('.nav-item').nth(3)).toHaveClass(/active/);
      await expect(page.locator('#tab-wordbook')).toBeVisible();
      await expect(page.locator('#tab-wordbook')).toHaveClass(/active/);
    });

    test('点击"连接设置"→ 切回连接 Tab', async () => {
      await page.locator('.nav-item').nth(0).click();
      await expect(page.locator('.nav-item').nth(0)).toHaveClass(/active/);
      await expect(page.locator('#tab-general')).toBeVisible();
      await expect(page.locator('#tab-general')).toHaveClass(/active/);
    });
  });

  // ===================================================================
  // 4. 连接设置 Tab
  // ===================================================================
  test.describe('4. 连接设置', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
      // 确保在连接 Tab
      await page.locator('.nav-item').nth(0).click();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('页面标题为"连接设置"，描述文案正确', async () => {
      await expect(page.locator('#tab-general h2')).toHaveText('连接设置');
      await expect(page.locator('#tab-general .page-desc')).toHaveText('配置 AI 模型的连接信息');
    });

    test('API 地址输入框存在且可输入', async () => {
      const input = page.locator('#apiUrl');
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute('type', 'url');
      // 默认值应为 OpenCode 地址
      const value = await input.inputValue();
      expect(value).toBe('https://opencode.ai/zen/v1/chat/completions');
    });

    test('API 密钥输入框和显示/隐藏按钮存在', async () => {
      await expect(page.locator('#apiKey')).toBeVisible();
      await expect(page.locator('#apiKey')).toHaveAttribute('type', 'password');
      await expect(page.locator('#toggleApiKey')).toBeVisible();
    });

    test('模型 ID 输入框和提示 chips 存在', async () => {
      await expect(page.locator('#model')).toBeVisible();
      const chips = page.locator('.hint-chip');
      await expect(chips).toHaveCount(6);
      // 验证 chip 文字
      const chipTexts = await chips.allTextContents();
      expect(chipTexts).toEqual([
        'gpt-4o',
        'gpt-4o-mini',
        'deepseek-chat',
        'deepseek-reasoner',
        'moonshot-v1-8k',
        'qwen-turbo',
      ]);
    });

    test('点击模型 chip 会填充到输入框', async () => {
      const modelInput = page.locator('#model');
      await modelInput.fill(''); // 清空
      await page.locator('.hint-chip').nth(0).click();
      await expect(modelInput).toHaveValue('gpt-4o');

      await page.locator('.hint-chip').nth(2).click();
      await expect(modelInput).toHaveValue('deepseek-chat');
    });

    test('存在 6 个服务商预设按钮，文字和 data-url 均正确', async () => {
      const presets = page.locator('.preset-btn');
      await expect(presets).toHaveCount(6);

      // 验证按钮文字
      const expectedTexts = [
        'OpenCode（推荐）',
        'DeepSeek（深度求索）',
        'OpenAI',
        'Moonshot（月之暗面）',
        'Ollama',
        'LM Studio',
      ];
      for (let i = 0; i < 6; i++) {
        await expect(presets.nth(i)).toContainText(expectedTexts[i]);
      }

      // 验证 data-url 属性
      const expectedUrls = [
        'https://opencode.ai/zen/v1/chat/completions',
        'https://api.deepseek.com/v1/chat/completions',
        'https://api.openai.com/v1/chat/completions',
        'https://api.moonshot.cn/v1/chat/completions',
        'http://localhost:11434/v1/chat/completions',
        'http://localhost:1234/v1/chat/completions',
      ];
      for (let i = 0; i < 6; i++) {
        await expect(presets.nth(i)).toHaveAttribute('data-url', expectedUrls[i]);
      }

      // 每个按钮都包含圆点指示器
      for (let i = 0; i < 6; i++) {
        await expect(presets.nth(i).locator('.preset-dot')).toBeVisible();
      }
    });

    test('默认选中 OpenCode 预设', async () => {
      await expect(page.locator('.preset-btn').nth(0)).toHaveClass(/active/);
    });

    test('点击不同预设按钮会更新 API URL 输入框并切换 active 状态', async () => {
      const presets = page.locator('.preset-btn');
      const apiInput = page.locator('#apiUrl');

      // 点击 DeepSeek
      await presets.nth(1).click();
      await expect(presets.nth(1)).toHaveClass(/active/);
      await expect(presets.nth(0)).not.toHaveClass(/active/);
      await expect(apiInput).toHaveValue('https://api.deepseek.com/v1/chat/completions');

      // 点击 Ollama
      await presets.nth(4).click();
      await expect(presets.nth(4)).toHaveClass(/active/);
      await expect(presets.nth(1)).not.toHaveClass(/active/);
      await expect(apiInput).toHaveValue('http://localhost:11434/v1/chat/completions');

      // 点回 OpenCode
      await presets.nth(0).click();
      await expect(presets.nth(0)).toHaveClass(/active/);
      await expect(apiInput).toHaveValue('https://opencode.ai/zen/v1/chat/completions');
    });

    test('存在操作按钮：测试连接、保存、恢复默认', async () => {
      const testBtn = page.locator('#testBtn');
      const saveBtn = page.locator('#saveBtn');
      const resetBtn = page.locator('#resetBtn');
      const statusEl = page.locator('#saveStatus');

      await expect(testBtn).toBeVisible();
      await expect(testBtn).toContainText('测试连接');

      await expect(saveBtn).toBeVisible();
      await expect(saveBtn).toContainText('保存');

      await expect(resetBtn).toBeVisible();
      await expect(resetBtn).toContainText('恢复默认');

      await expect(statusEl).toBeVisible();
    });

    test('提示文字"密钥仅存储在本地浏览器中"存在', async () => {
      await expect(page.locator('.field-hint').first()).toContainText('密钥仅存储在本地浏览器中');
    });
  });

  // ===================================================================
  // 5. 外观设置 Tab
  // ===================================================================
  test.describe('5. 外观设置', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
      await page.locator('.nav-item').nth(1).click();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('页面标题为"外观设置"，描述文案正确', async () => {
      await expect(page.locator('#tab-appearance h2')).toHaveText('外观设置');
      await expect(page.locator('#tab-appearance .page-desc')).toHaveText('自定义翻译弹窗的外观样式');
    });

    test('存在 3 个主题卡片，文字正确', async () => {
      const cards = page.locator('.theme-card');
      await expect(cards).toHaveCount(3);
      await expect(cards.nth(0)).toContainText('跟随系统');
      await expect(cards.nth(1)).toContainText('浅色');
      await expect(cards.nth(2)).toContainText('深色');
    });

    test('每个主题卡片内包含 radio 输入和 SVG 图标', async () => {
      const cards = page.locator('.theme-card');
      for (let i = 0; i < 3; i++) {
        await expect(cards.nth(i).locator('input[type="radio"]')).toBeVisible();
        await expect(cards.nth(i).locator('svg')).toBeVisible();
      }
    });

    test('默认选中"跟随系统"', async () => {
      const autoRadio = page.locator('input[name="theme"][value="auto"]');
      await expect(autoRadio).toBeChecked();
      await expect(page.locator('.theme-card').nth(0)).toHaveClass(/active/);
    });

    test('点击"浅色"卡片——radio 选中、卡片高亮', async () => {
      const cards = page.locator('.theme-card');
      await cards.nth(1).click();
      const lightRadio = page.locator('input[name="theme"][value="light"]');
      await expect(lightRadio).toBeChecked();
      await expect(cards.nth(1)).toHaveClass(/active/);
      await expect(cards.nth(0)).not.toHaveClass(/active/);
    });

    test('点击"深色"卡片——radio 选中、卡片高亮', async () => {
      const cards = page.locator('.theme-card');
      await cards.nth(2).click();
      const darkRadio = page.locator('input[name="theme"][value="dark"]');
      await expect(darkRadio).toBeChecked();
      await expect(cards.nth(2)).toHaveClass(/active/);
      await expect(cards.nth(1)).not.toHaveClass(/active/);
    });

    test('点击"跟随系统"切回默认', async () => {
      const cards = page.locator('.theme-card');
      await cards.nth(0).click();
      const autoRadio = page.locator('input[name="theme"][value="auto"]');
      await expect(autoRadio).toBeChecked();
      await expect(cards.nth(0)).toHaveClass(/active/);
    });

    test('字体大小滑块存在，范围 10-24，默认 14', async () => {
      const slider = page.locator('#fontSize');
      await expect(slider).toBeVisible();
      await expect(slider).toHaveAttribute('type', 'range');
      await expect(slider).toHaveAttribute('min', '10');
      await expect(slider).toHaveAttribute('max', '24');
      await expect(slider).toHaveValue('14');
    });

    test('字体大小滑块拖动后显示值同步更新', async () => {
      const slider = page.locator('#fontSize');
      const display = page.locator('#fontSizeValue');

      // 默认 14px
      await expect(display).toHaveText('14px');

      // 拖到 18
      await slider.fill('18');
      await expect(display).toHaveText('18px');
      await expect(slider).toHaveValue('18');

      // 拖到最大值 24
      await slider.fill('24');
      await expect(display).toHaveText('24px');
      await expect(slider).toHaveValue('24');

      // 拖到最小值 10
      await slider.fill('10');
      await expect(display).toHaveText('10px');
      await expect(slider).toHaveValue('10');

      // 恢复原值
      await slider.fill('14');
    });

    test('底部提示文字存在', async () => {
      await expect(page.locator('#tab-appearance .tab-note')).toContainText('更改将在翻译弹窗中实时生效');
    });
  });

  // ===================================================================
  // 6. 翻译风格 Tab
  // ===================================================================
  test.describe('6. 翻译风格', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
      await page.locator('.nav-item').nth(2).click();
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('页面标题为"翻译风格"，描述文案正确', async () => {
      await expect(page.locator('#tab-style h2')).toHaveText('翻译风格');
      await expect(page.locator('#tab-style .page-desc')).toHaveText('选择翻译风格或自定义翻译提示词');
    });

    test('存在 6 个风格预设卡片，文字正确', async () => {
      const cards = page.locator('.style-card');
      await expect(cards).toHaveCount(6);

      const expectedTexts = ['标准', '正式商务', '口语自然', '学术论文', '诗歌文艺', '技术文档'];
      for (let i = 0; i < 6; i++) {
        await expect(cards.nth(i)).toContainText(expectedTexts[i]);
      }
    });

    test('默认选中"标准"风格', async () => {
      await expect(page.locator('.style-card').nth(0)).toHaveClass(/active/);
    });

    test('点击"正式商务"— 高亮切换 + textarea 填充内容', async () => {
      const cards = page.locator('.style-card');
      const textarea = page.locator('#customPrompt');

      await cards.nth(1).click();
      await expect(cards.nth(1)).toHaveClass(/active/);
      await expect(cards.nth(0)).not.toHaveClass(/active/);

      // textarea 应被填充且包含目标语言占位符
      const val = await textarea.inputValue();
      expect(val.length).toBeGreaterThan(30);
      expect(val).toContain('{targetLang}');
      expect(val).toContain('商务');
    });

    test('依次点击所有 6 个预设，每个都会填充 textarea 且内容不同', async () => {
      const cards = page.locator('.style-card');
      const textarea = page.locator('#customPrompt');

      // 标准
      await cards.nth(0).click();
      let val = await textarea.inputValue();
      expect(val).toContain('{targetLang}');
      expect(val).toContain('翻译助手');

      // 口语自然
      await cards.nth(2).click();
      val = await textarea.inputValue();
      expect(val).toContain('口语');
      expect(val).toContain('避免翻译腔');

      // 学术论文
      await cards.nth(3).click();
      val = await textarea.inputValue();
      expect(val).toContain('学术');
      expect(val).toContain('术语准确');

      // 诗歌文艺
      await cards.nth(4).click();
      val = await textarea.inputValue();
      expect(val).toContain('文学');
      expect(val).toContain('韵律');

      // 技术文档
      await cards.nth(5).click();
      val = await textarea.inputValue();
      expect(val).toContain('技术');
      expect(val).toContain('Markdown');
    });

    test('自定义 textarea 可手动输入', async () => {
      const textarea = page.locator('#customPrompt');
      await textarea.fill('');
      await expect(textarea).toHaveValue('');

      const customText = '请将以下内容翻译成{targetLang}，保持原文格式。';
      await textarea.fill(customText);
      await expect(textarea).toHaveValue(customText);
    });

    test('手动修改 textarea 后，所有风格卡片取消高亮', async () => {
      // 先点一个预设
      await page.locator('.style-card').nth(0).click();
      await expect(page.locator('.style-card').nth(0)).toHaveClass(/active/);

      // 手动修改 textarea
      const textarea = page.locator('#customPrompt');
      await textarea.fill('自定义内容，不匹配任何预设');

      // 所有预设应取消 active
      const cards = page.locator('.style-card');
      for (let i = 0; i < 6; i++) {
        await expect(cards.nth(i)).not.toHaveClass(/active/);
      }
    });

    test('底部提示文字存在', async () => {
      await expect(page.locator('#tab-style .tab-note')).toContainText('选中的风格预设会自动填充到自定义提示词框中');
    });
  });

  // ===================================================================
  // 7. 单词本 Tab — 空状态
  // ===================================================================
  test.describe('7. 单词本', () => {

    let page;

    test.beforeAll(async () => {
      page = await openOptionsPage();
      await page.locator('.nav-item').nth(3).click();
      // 等待 loadWordbook 异步请求完成
      await page.waitForTimeout(600);
    });

    test.afterAll(async () => {
      await page.close().catch(() => {});
    });

    test('页面标题为"单词本"，描述文案显示词条数', async () => {
      await expect(page.locator('#tab-wordbook h2')).toHaveText('单词本');
      await expect(page.locator('#wordbookCount')).toBeVisible();
    });

    test('工具栏存在：搜索框、导出按钮、清空按钮', async () => {
      await expect(page.locator('#wordbookSearch')).toBeVisible();
      await expect(page.locator('#wordbookSearch')).toHaveAttribute('placeholder', '搜索单词或翻译...');
      await expect(page.locator('#exportWordbookBtn')).toBeVisible();
      await expect(page.locator('#exportWordbookBtn')).toContainText('导出');
      await expect(page.locator('#clearWordbookBtn')).toBeVisible();
      await expect(page.locator('#clearWordbookBtn')).toContainText('清空');
    });

    test('空状态下显示"还没有收藏任何单词"', async () => {
      // 空状态面板应可见
      const emptyState = page.locator('#wordbookEmpty');
      await expect(emptyState).toBeVisible({ timeout: 3000 });

      // 核心断言：空状态文案
      await expect(emptyState.locator('p')).toHaveText('还没有收藏任何单词');

      // 确认单词列表为空
      const list = page.locator('#wordbookList');
      await expect(list).toBeVisible();
      const items = list.locator('.wordbook-item');
      await expect(items).toHaveCount(0);

      // 空状态配有 SVG 图标
      await expect(emptyState.locator('svg')).toBeVisible();
    });

    test('搜索框中输入文字后，空状态文案变为"没有匹配的单词"', async () => {
      const searchInput = page.locator('#wordbookSearch');
      const emptyState = page.locator('#wordbookEmpty');

      await searchInput.fill('不存在的单词xxxx');
      await page.waitForTimeout(300);

      await expect(emptyState).toBeVisible();
      await expect(emptyState.locator('p')).toHaveText('没有匹配的单词');

      // 清空搜索框，恢复原始空状态文案
      await searchInput.fill('');
      await page.waitForTimeout(300);
      await expect(emptyState.locator('p')).toHaveText('还没有收藏任何单词');
    });
  });
});
