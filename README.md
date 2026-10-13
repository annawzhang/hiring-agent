# Hiring Agent · 招聘运营助手

**对话式招聘运营 Agent：超时催办、证据化初筛、受规则约束的推进/淘汰、邀约模板与分析摘要。只能调用与 [Hiring Copilot](https://github.com/annawzhang/hiring-copilot) 同一套 `Hire.*` 引擎，不会编造简历。**

[在线体验](https://annawzhang.github.io/hiring-agent/) · [测试](https://annawzhang.github.io/hiring-agent/tests.html) · [架构手册](https://annawzhang.github.io/people-product-handbook/sections/01-hiring.html)

> 职位与候选人均为虚构；状态存在浏览器 localStorage。

## 和 Copilot 的分工

| | Hiring Copilot | Hiring Agent（本仓库） |
|---|---|---|
| 形态 | 四页签工作台 | 对话 + 工具调用 |
| 规则 | `Hire.*` 引擎 | **同一份** data/engine |
| 价值 | 可视化操作 | 演示「Agent 只能走白名单，违规被引擎拒绝」 |

## 工具白名单

`list_sla` · `screen` · `analytics` · `draft_message` · `advance` · `reject` · `reset`

推进时若反馈未齐、需要复盘会、或招聘名额已满，Agent 会返回「规则拒绝：…」，而不是自行绕过。

## 本地运行

```bash
python3 -m http.server 8000
# http://localhost:8000/  ·  http://localhost:8000/tests.html
```
