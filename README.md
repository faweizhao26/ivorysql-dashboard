# IvorySQL 运营数据面板

基于 Next.js 的开源项目运营数据看板，支持 GitHub 数据自动获取和手动数据录入。

## 功能特性

- **GitHub 数据**：Stars、Forks、Watchers、Contributors、Open Issues/PRs、Release 等
- **社交媒体**：公众号、Twitter、B站、YouTube 粉丝和互动数据
- **技术内容平台**：CSDN、掘金、墨天轮、开源中国、思否、51CTO、ITPUB、头条号、IFCLUB
- **官网数据**：PV/UV、流量来源、热门页面、搜索关键词
- **趋势图表**：支持日/周/月/季/年维度切换
- **社区动态**：聚合 GitHub Issue/PR/Release、博客更新、活动动态
- **自动更新**：通过 GitHub Actions 每日自动抓取数据
- **权限控制**：Vercel Password Protection 密码保护

## 页面结构

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/` | 核心指标概览、趋势图、最新动态 |
| GitHub | `/github` | 仓库数据、贡献者统计 |
| 社媒 | `/social` | 公众号、Twitter、B站、YouTube 数据 |
| 内容 | `/content` | 技术平台文章统计 |
| 官网 | `/website` | 网站流量分析 |
| 管理 | `/admin` | 手动数据录入 |

## 快速部署

### 1. Fork 本仓库

### 2. 在 Vercel 导入项目

```
https://vercel.com/new
```

选择你的 GitHub 仓库导入。

### 3. 配置环境变量（可选）

在 Vercel 项目设置中添加：

| 变量名 | 说明 |
|--------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token（用于 API 调用） |

### 4. 启用密码保护

在 Vercel 控制台：

```
Settings → General → Password Protection → Enable
```

设置访问密码。

### 5. 部署

点击 Deploy，Vercel 将自动构建并部署。

## 本地开发

```bash
# 安装依赖
npm install

# 填充示例数据
npm run seed

# 启动开发服务器
npm run dev

# 获取 GitHub 数据
npm run fetch-github
```

## 数据更新

### 自动更新

项目已配置 GitHub Actions（`.github/workflows/update-data.yml`），每天 UTC 02:00 自动抓取 GitHub 数据并提交更新。

### 手动数据录入

访问 `/admin` 页面，手动录入以下数据：

| 类型 | 数据项 | 更新频率 |
|------|--------|----------|
| 社交媒体 | 公众号、Twitter、B站、YouTube 粉丝/阅读量 | 每周 |
| 内容平台 | CSDN、掘金等平台文章数、阅读量、粉丝数 | 每周 |

## 支持的平台

### 社交媒体
- 💚 公众号（手动）
- 🐦 Twitter（手动）
- 📺 B站（手动）
- ▶️ YouTube（手动）

### 技术内容平台
- 🔵 CSDN（手动）
- 💎 掘金（手动）
- 🟠 墨天轮（手动）
- 🟢 开源中国（手动）
- ⚡ 思否（手动）
- 📰 51CTO（手动）
- 🔷 ITPUB（手动）
- 📱 头条号（手动）
- 💬 IFCLUB（手动）

## 项目结构

```
ivorysql-dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx           # 首页/概览
│   │   ├── github/page.tsx   # GitHub 数据
│   │   ├── social/page.tsx   # 社交媒体
│   │   ├── content/page.tsx   # 内容平台
│   │   ├── website/page.tsx   # 官网数据
│   │   ├── admin/page.tsx    # 管理后台
│   │   └── api/              # API 路由
│   ├── components/            # UI 组件
│   └── lib/                   # 数据库和工具
├── data/                      # SQLite 数据库
└── .github/workflows/        # GitHub Actions
```

## 技术栈

- **框架**：Next.js 16 (App Router)
- **样式**：Tailwind CSS
- **图表**：Recharts
- **数据库**：SQLite (better-sqlite3)
- **部署**：Vercel (Hobby Plan 免费)

## 费用

| 项目 | 费用 |
|------|------|
| Vercel Hobby | 免费 |
| GitHub Actions | 免费 |
| 数据库 | 免费 (SQLite) |

**预计总费用：¥0**

## License

MIT
