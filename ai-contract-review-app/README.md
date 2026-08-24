# 衡鉴 AI 合同审查

基于高保真原型实现的全栈 MVP。前端使用 React + TypeScript，后端使用 Python + FastAPI，AI 审查由服务端调用 DeepSeek `deepseek-chat`。

## 已实现功能

- DOCX、可复制文本 PDF、TXT 和在线粘贴文本
- 合同类型、审查立场、审查模板配置
- DeepSeek 结构化风险审查与 Pydantic 服务端校验
- 高/中/低/提示四级风险、原文位置、问题说明、修改建议与依据
- 接受、拒绝、编辑、忽略审查意见
- 合同、审查结果与操作日志本地持久化
- Word、PDF、JSON 审查结果导出
- 首页、审查工作台、报告、合同列表和基础权限界面

## 本地运行

要求 Python 3.11 或更高版本、Node.js 20 或更高版本、pnpm。

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
pnpm install
cp .env.example .env.local
# 在 .env.local 中配置 DEEPSEEK_API_KEY
pnpm dev
```

浏览器打开 `http://127.0.0.1:5173`。API 默认运行在 `http://127.0.0.1:8787`。

## 校验命令

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 安全说明

- DeepSeek API Key 只存在于 `.env.local`，该文件已被 `.gitignore` 排除。
- 前端不会获得或回显 API Key，模型请求全部由服务端代理。
- 调用 AI 审查时，合同正文会发送给配置的 DeepSeek API。正式上线前应确认企业的数据出境、隐私和供应商合规要求。
- 当前数据存储为本地 JSON，适合单机 MVP。生产环境应替换为数据库、对象存储、企业 SSO、细粒度权限和加密密钥管理。

## 目录结构

```text
src/                 React 前端
backend/              FastAPI、DeepSeek、解析、导出和持久化
backend/tests/        Python 服务端测试
data/                本地数据目录（业务数据不提交）
.env.local           本地密钥配置（不提交）
pyproject.toml        Python 依赖和测试配置
```
