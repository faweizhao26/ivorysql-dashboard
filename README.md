# IvorySQL 运营数据面板

基于 Next.js 16 和 PostgreSQL 的 IvorySQL 社区运营看板，汇总 GitHub、内容平台、社交媒体、官网、活动与布道者数据。

## 页面与能力

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/` | 核心指标、真实数据日期和最近更新时间 |
| GitHub | `/github` | 仓库指标、贡献者月度活动与新增贡献者 |
| 社媒 | `/social` | 公众号、视频号、Twitter、B站和 YouTube |
| 内容 | `/content` | 各内容平台汇总、分页检索和 CSV 导出 |
| 官网 | `/website` | PV、UV、热门页面和流量来源 |
| 活动 | `/events` | IvorySQL 社区活动 |
| 布道者 | `/evangelist` | 布道者积分与贡献记录 |
| 管理 | `/admin` | 数据录入、文章维护、提醒和同步状态 |

看板区分两个时间：`data_date` 是指标对应的统计日期，`updated_at` 是数据最近写入时间。筛选日期没有记录时，页面会明确显示“最新可用数据”，不会把历史值标成当天数据。

## 数据自动化

### Vercel Cron

`vercel.json` 中的任务通过受保护的同步入口运行，并将成功、失败、读写数量和错误记录到 `sync_runs`。Vercel 会使用 `CRON_SECRET` 调用 GET 路由。

| 平台 | 计划 | 数据范围 |
|------|------|----------|
| GitHub | 每天 | 仓库指标、贡献者活动、Release、GitHub 与 Docker 下载量 |
| CSDN | 每天 | 作者主页最近文章 |
| 博客园 | 每天 | 作者主页最近文章 |
| 墨天轮 | 每天 | 用户页嵌入数据中的文章指标 |
| 思否 | 每天 | 已知文章链接的阅读量 |
| ITPUB | 每周一 | 作者主页最近文章 |

GitHub 贡献者统计从 `IvorySQL/IvorySQL` 仓库的实际创建日期开始扫描，不使用固定的 2025 年起点。月度贡献者包括当月创建 Issue 的用户和当月 PR 被合并的用户；未合并 PR 不计入该指标。页面同时区分“2026 年首次贡献”和“历史首次贡献”。

### ego-lite

开源中国、51CTO、头条号和知乎由本机 ego-lite 浏览器采集最近 50 篇，再写入 `/api/browser-content/sync`。该接口需要 `CRON_SECRET`，运行结果同样进入后台“同步状态”。这四个平台不在 Vercel Cron 中重复抓取。

### 人工维护

- 公众号和视频号无法稳定从公开页面获得完整后台指标，继续人工导入。
- Twitter、B站、YouTube 和 IFCLUB 当前人工维护。
- 掘金账号已停用，只保留历史数据，不再同步，也不再触发过期提醒。
- 自动采集只更新来源能提供的指标，不自动猜测文章分类和来源。

## 部署

1. 在 Vercel 导入本仓库。
2. 连接一个持久化 PostgreSQL 数据库。
3. 在 Project Settings → Environment Variables 配置环境变量。
4. 部署后访问 `/admin`，在“同步状态”检查首次运行结果。

必需变量：

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `ACCESS_PASSWORD` | 只读访问密码 |
| `ADMIN_PASSWORD` | 管理员密码 |
| `CRON_SECRET` | Vercel Cron 与 ego-lite 写入鉴权 |
| `GITHUB_TOKEN` | GitHub API；需要读取公开仓库数据的权限与足够额度 |

可选变量：

| 变量 | 默认值 | 用途 |
|------|--------|------|
| `GITHUB_REPO` | `IvorySQL/IvorySQL` | GitHub 主仓库 |
| `ITPUB_USER_ID` | 项目内默认账号 | ITPUB 作者账号 |
| `MODB_USER_ID` | 项目内默认账号 | 墨天轮作者账号 |

不要在生产环境设置 `ALLOW_SAMPLE_DATA=1`。该变量只用于明确允许写入演示数据的特殊场景。

## 本地开发

```bash
npm install
npm run dev
```

本地也需要可访问的 `DATABASE_URL`。常用验证命令：

```bash
npm test
npm run build
```

`npm run seed` 会写入演示数据：开发环境可运行，生产环境默认拒绝。若怀疑数据库中存在早期演示记录，先执行只读审计：

```bash
node scripts/audit-sample-data.mjs
```

确认清单后才能执行隔离脚本；脚本要求显式确认参数，并会先复制到 `quarantined_sample_data`，再在同一事务中删除业务表记录。不要按日期整段删除。

## 内容数据维护

- 页面首屏只请求平台汇总，选择平台后分页获取文章。
- `/api/content/export` 用于完整 CSV 导出，不复用页面列表响应。
- 后台“同步状态”显示各平台最近运行、读写数量和失败原因；支持的服务端采集器可手动重试。
- ego-lite 渠道需要在本机浏览器任务中重跑，后台不会尝试绕过平台登录或验证。

## 技术栈

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Recharts
- PostgreSQL (`pg`)
- Vercel Cron

## License

MIT
