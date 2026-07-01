---
name: browser-ext-pipeline
description: 浏览器扩展开发全自动流水线。当用户描述需要开发一个浏览器扩展（Chrome/Edge 插件）时触发。按照 开发→审查→测试 三阶段自动执行。
---

# 浏览器扩展开发流水线

当用户描述浏览器扩展需求时，严格按照以下三个阶段自动执行：

## 阶段一：开发 (dev-agent)

使用 Task 工具调用 `dev-agent`，将用户的需求原样传递给它。等待其返回 JSON 格式的代码输出。

## 阶段二：审查 (review-agent)

将 dev-agent 返回的完整 JSON 代码作为输入，使用 Task 工具调用 `review-agent`，要求其严格审查代码。

- 如果 `status` 为 `"REJECTED"`，将 issues 列表反馈给 dev-agent 修复代码，重新执行阶段一和阶段二。
- 如果 `status` 为 `"APPROVED"`，进入阶段三。

## 阶段三：测试 (test-agent)

将审查通过的代码，使用 Task 工具调用 `test-agent`，生成 Playwright 测试脚本。

## 最终输出

将三个阶段的结果汇总呈现给用户：
1. dev-agent 生成的项目文件列表
2. review-agent 的审查结论
3. test-agent 的测试用例和脚本

## 注意事项

- 每个阶段必须使用 Task 工具调用对应的 agent，不要自己替代 agent 的工作
- dev-agent 输出的 JSON 需原样传递给 review-agent，不要做格式转换
- 如果审查不通过，务必让 dev-agent 根据 issues 修复后再重新审查
