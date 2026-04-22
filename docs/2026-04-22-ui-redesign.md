# IvorySQL Dashboard UI 优化设计规范

## 1. 设计方向

参考 pgnexus.ai 风格，打造专业数据仪表盘：

- **深色主题** - 减少视觉疲劳，突出数据
- **紫色/蓝色渐变** - 科技感、专业
- **Area Chart 渐变填充** - 增强数据可视化效果
- **优化卡片设计** - 更好的阴影、边框、间距
- **骨架屏加载状态** - 提升加载体验

---

## 2. 色彩系统

### 主色调
- **Primary**: `#8B5CF6` (紫色) / `#6366F1` (靛蓝)
- **Accent Gradient**: `from-indigo-600 via-purple-500 to-pink-500`

### 深色背景
- **Background**: `#0f172a` (深蓝黑) - slate-900
- **Card Background**: `#1e293b` (slate-800)
- **Card Border**: `#334155` (slate-700)

### 文本
- **Primary Text**: `#f8fafc` (slate-50)
- **Secondary Text**: `#94a3b8` (slate-400)
- **Muted Text**: `#64748b` (slate-500)

### 图表渐变
- **GitHub Stars**: `from-indigo-500 to-purple-600`
- **Forks**: `from-blue-500 to-cyan-500`
- **Contributors**: `from-purple-500 to-pink-500`

---

## 3. 组件样式

### 卡片
- 背景: `#1e293b`
- 边框: `1px solid #334155`
- 圆角: `16px` (rounded-2xl)
- 内边距: `24px`
- 悬停: 边框变亮 + subtle glow

### 导航栏
- 背景: `#0f172a` (与页面背景一致)
- 边框底部: `1px solid #334155`
- 高度: `64px`

### 图表
- Area chart 带渐变填充
- 网格线: `#334155`
- Y轴文字: `slate-400`
- X轴文字: `slate-500`

### 数字展示
- 主数字: `32-48px`, bold, `slate-50`
- 变化百分比: 带颜色（绿色上涨，红色下跌）

### 按钮
- Primary: 渐变背景 `bg-gradient-to-r from-indigo-600 to-purple-600`
- 悬停: 亮度提升 + 微微放大

---

## 4. 加载状态

骨架屏使用：
- `animate-pulse`
- 深色背景上的稍浅色块

---

## 5. 页面结构

### 导航
- 顶部固定导航栏（64px）
- 左侧 Logo + 项目名
- 右侧 nav items + 用户信息

### 首页布局
- 核心指标卡片网格 (2-3列)
- 趋势图表 (占满宽度)
- 双栏布局：左侧趋势，右侧活动

---

## 6. 实现清单

- [ ] 更新 Tailwind 配置（自定义颜色）
- [ ] 更新全局样式（深色背景）
- [ ] 更新 Layout（导航栏样式）
- [ ] 更新 StatCard 组件
- [ ] 更新 Chart 组件（渐变填充）
- [ ] 更新加载状态（骨架屏）
- [ ] 更新页面背景和卡片
