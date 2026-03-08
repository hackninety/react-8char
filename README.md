# 八字排盘 (BaZi PaiPan)

基于 React + TypeScript 的现代八字排盘工具，采用渊海子平体系，提供完整的四柱八字排盘、大运流年流月流日流时分析、JSON 导出等功能。

## 技术栈

- **框架**: Vite + React 18 + TypeScript
- **UI**: Tailwind CSS + shadcn/ui + lucide-react
- **动画**: framer-motion
- **排盘核心**: [mystilight-8char-v2](../mystilight-8char-v2) (fork 扩展版)
- **通知**: react-hot-toast

## 功能特性

- **四柱排盘** - 公历/农历/八字反查三种输入方式
- **真太阳时** - 基于出生城市经度自动校正（80+ 城市，按省分组）
- **五行力量** - 可视化进度条展示五行力量分布
- **命盘要素** - 胎元、胎息、命宫、身宫
- **渊海子平** - 身强、湿度、阴阳、月令、太岁分析
- **命理分析** - 喜用神、日时分析、三命通会
- **干支关系** - 天干关系、地支关系（合冲刑害）
- **大运流年** - 五级联动：大运 → 流年 → 流月 → 流日 → 流时
- **JSON 导出** - 压缩格式，含渊海子平/分派元信息，可直接喂 AI 分析
- **AI Prompt** - 一键生成 AI 分析专用提示词
- **响应式** - 移动端适配
- **暗色模式** - 支持明暗主题切换

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 项目结构

```
src/
  main.tsx              # 入口
  App.tsx               # 主组件（主题、状态管理）
  lib/
    bazi.ts             # 排盘逻辑（调用 mystilight-8char-v2）
    cities.ts           # 城市列表（80+ 城市，按省分组）
    utils.ts            # 工具函数（五行颜色、十神颜色等）
    prompt-template.ts  # AI 提示词模板
  components/
    BaziForm.tsx        # 输入表单（公历/农历/八字反查）
    BaziChart.tsx       # 排盘结果总布局
    PillarCard.tsx      # 四柱卡片
    WuXingChart.tsx     # 五行力量图
    ShenShaList.tsx     # 命盘要素/渊海子平/命理分析/干支关系
    DaYunTimeline.tsx   # 大运·流年·流月·流日·流时
    JsonExport.tsx      # JSON 导出/复制/AI Prompt
    ThemeToggle.tsx     # 主题切换
```

## 依赖说明

本项目核心排盘计算依赖 `mystilight-8char-v2`（本地 file: 引用），该库是 [mystilight-8char](https://github.com/mystilight/mystilight-8char) 的 fork 扩展版本，在不修改原版代码的前提下新增了流月/流日/流时/十神计算等扩展 API。

## 许可证

MIT
