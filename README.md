# FoodTI · 食格测试

> 「~~MBTI~~ 食物塑」16 种食物找你的闺蜜搭子

把你比喻成 16 种食物之一,告诉你你的 **灵魂搭子 / 互补搭子 / 解压搭子** 分别是谁。
你只会看到一份食物档案,完全感觉不到背后用的是 16 格人格框架。

模板灵感来自 [futuewaker/petti](https://github.com/futuewaker/petti),主题改成 **闺蜜找搭子 · 糖果粉**。

## 演示

```bash
git clone https://github.com/futuewaker/foodti.git
cd foodti
python3 -m http.server 8766
open http://localhost:8766
```

无依赖,无构建,纯静态。也可以直接 deploy 到 Cloudflare Pages / Vercel / GitHub Pages。

## 16 食物速览

| MBTI(隐藏) | 食物 | 气质关键词 | 隐藏款 |
|---|---|---|---|
| ENFP | 草莓蛋糕 | 甜 / 外放 / 浪漫 | — |
| ENTP | 跳跳糖汽水 | 跳脱 / 好奇 | — |
| ESFP | 全糖奶茶 | 快乐 / 热闹 | ✨ 甜甜圈 |
| ESTP | 辣辣辣条 | 刺激 / 直接 | — |
| ENFJ | 热可可 | 温暖 / 共情 | — |
| ENTJ | 意式浓缩 | 理性 / 控制 | — |
| ESFJ | 曲奇小饼干 | 体贴 / 稳定 | — |
| ESTJ | 有机沙拉 | 有序 / 高效 | — |
| INFP | 马卡龙 | 柔软 / 敏感 | — |
| INTP | QQ 果冻 | 抽象 / 内向 | — |
| ISFP | 粉淇凌 | 审美 / 温柔 | — |
| ISTP | 饭团 | 实用 / 冷静 | — |
| INFJ | 82 年的拉菲 | 深度 / 克制 | — |
| INTJ | 101% 黑巧力 | 冷静 / 精准 | — |
| ISFJ | 家的味道 | 温柔 / 守护 | — |
| ISTJ | 蛋包饭 | 稳定 / 责任 | ✨ 大鸡腿 |

## 设计承诺

1. **16 食物 ⇄ 16 内部分型严格 1:1**(由 `foods.json` 主键约束)
2. **匹配算法零平局**——每维度 4 题、权重 (2,1,1,1)、二选一,数学上每维总分差 ∈ {±1, ±3, ±5},零分不可达 ⇒ 类型必然唯一确定
3. **用户视角不出现 MBTI 字母**——分类结果直接呈现为食物档案
4. **题目场景围绕『吃饭 / 闺蜜场景 / 搭子』**——食物相关但探测的是普适人格维度,不强扯
5. **隐藏款** — ESFP 和 ISTJ 各 50% 概率触发,徽章会跳动

## 算法

```
用户作答 16 题
  ↓ 每题 ±weight 累加到对应字母(E/I, S/N, T/F, J/P)
四维各自取得分高的字母
  ↓ 拼成 4 字母 key
查 foods.json 中 mbti 字段匹配的食物
  ↓
返回 food + confidences,前端渲染食物档案 + 搭子图谱
```

详见 [`lib/classifier.js`](lib/classifier.js) 头部注释。

## 文件结构

```
foodti/
├── index.html            # 三视图 SPA(intro / quiz / result)
├── app.js                # 主程序 IIFE
├── styles.css            # 糖果粉主题(基于 petti 模板)
├── data/
│   ├── questions.json    # 16 题(4 维 × 4 题,(2,1,1,1) 权重)
│   └── foods.json        # 16 食物档案 + friendships 搭子推荐
├── lib/
│   └── classifier.js     # ES module 版的分类器(浏览器与 Node 共用)
├── scripts/
│   └── test-classifier.js  # 自检:65536 答案枚举 + 数据完整性
├── images/               # 18 张像素食物图(含 2 张隐藏款 + QR)
├── package.json
└── README.md
```

## 自检

### 数据完整性 + 算法零平局

```bash
npm test
# ✓ 16/16 MBTI types reachable
# ✓ 0 ties across 65536 binary-projection combinations
# ✓ 0 ties across 50000 N-ary random samples
# ✓ foods.json covers all 16 MBTI cells exactly once
# ✓ questions.json schema valid (3+ options per question)
```

### 32 人格对抗式准确率回归测试

模拟 32 名用户(2 名/MBTI × 16 类型,真诚答题模型 95%/99% 对齐)走完整流程,验证算法是否能把答案准确映射回 MBTI:

```bash
npm run test:personas
# ✓ 32/32 EXACT(2026-04-26 v4 题库)
# 任一维度低置信度时,UI 会显示 alt-hint 提示用户也有点像 secondary food
```

题库或算法改动后,跑这个回归测试看是否还能 28+/32(基线 87.5%)。

## 结果页内容

- **食物头像 + 食格标题**(带隐藏款徽章)
- **气质标签 / 食格速评**(带分享小按钮)
- **食格深度解读**
- **副指数**:外放度 / 感性度
- **味道画像**(6 轴雷达:甜咸辣酸苦鲜)
- **同气质别名**
- **🍱 搭子图谱**:💖 契合搭子 / 🌗 互补搭子 / 🍿 解压搭子(各推荐 1 个食物 + 解读)
- **典型场景**
- **扫码 QR 卡**
- **一键长截图保存** / 复制分享链接 / 再测一次
- **小红书作者推广卡**(URL 占位,部署时替换)

## 致谢

UI 模板与交互设计完全沿用 [@futuewaker/petti](https://github.com/futuewaker/petti),仅替换主题为食物 + 配色改为糖果粉。
长截图 / 分享 / iOS 模态保存 / 雷达图 / 跑马灯 / 进度条 等组件全部来自 petti。
