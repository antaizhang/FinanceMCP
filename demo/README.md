# FinanceMCP 新闻获取方法 Demo

本目录包含 FinanceMCP 项目中所有新闻获取方法的示例代码和说明文档。

## 📋 目录结构

```
demo/
├── README.md                          # 本文档
├── 1-tushare-hot-news.ts             # Tushare 7x24热点新闻示例
├── 2-baidu-news-search.ts            # 百度新闻爬虫示例
├── 3-finance-news-complete.ts        # 完整财经新闻搜索示例
└── package.json                       # Demo运行所需依赖
```

## 🔍 新闻获取方法概览

### 1. Tushare 7x24热点新闻 (hotNews)

**文件位置**: `src/tools/hotNews.ts`

**功能特点**:
- 从 Tushare API 获取最新的综合新闻（财经、政治、科技、体育、娱乐、军事、社会、国际等）
- 使用 Jaccard 相似度算法进行内容去重（默认阈值 0.8）
- 支持自定义返回条数（1-1500条，默认100条）
- 提供详细的来源统计和日期范围信息

**数据来源**: [Tushare 新闻快讯接口](https://tushare.pro/document/2?doc_id=143)

**使用场景**: 获取最新的综合热点新闻，适合实时新闻聚合

**核心算法**:
- **文本规范化**: 去除HTML标签和多余空格
- **n-gram分词**: 使用bigram（2字切分）进行文本分析
- **Jaccard相似度**: 计算两个文本的Jaccard系数判断相似度

---

### 2. 百度新闻搜索 (baiduNews)

**文件位置**: `src/tools/crawler/baiduNews.ts`

**功能特点**:
- 通过爬取百度新闻搜索页面获取新闻
- 支持多关键词搜索（空格分隔）
- 提取完整信息：标题、摘要、链接、来源、发布时间
- 双重解析策略（主策略+备用策略）保证稳定性

**解析策略**:
1. **主策略**: 解析 `div.result` 区块，提取完整新闻信息
2. **备用策略**: 解析 `h3.t > a` 标签，提取基础标题和链接

**使用场景**: 关键词搜索历史新闻，适合特定主题的新闻检索

---

### 3. 财经新闻搜索 (financeNews)

**文件位置**: `src/tools/financeNews.ts`

**功能特点**:
- 统一的新闻搜索接口
- 支持单个或多个关键词智能搜索
- 自动去重（基于标题+来源）
- 最多返回20条精选新闻
- 可扩展设计，支持添加更多新闻源

**工作流程**:
1. 解析搜索关键词（支持空格分隔多个词）
2. 并发调用多个新闻源（当前仅百度新闻）
3. 合并结果并去重
4. 返回格式化的新闻列表

**使用场景**: 通用的财经新闻搜索，适合特定股票、公司或事件的新闻查询

---

## 🛠️ 核心工具函数

### 去重算法 (utils.ts)

```typescript
// 基于标题+来源的去重
function removeDuplicates(news: NewsItem[]): NewsItem[]

// 基于内容相似度的去重
function deduplicateByContent(items: NewsItem[], threshold = 0.8): NewsItem[]
```

### 关键词匹配 (utils.ts)

```typescript
// OR逻辑：只要包含任意一个关键词即可
function containsKeywords(text: string, keywords: string[]): boolean
```

---

## 📊 数据结构

### NewsItem 接口

```typescript
interface NewsItem {
  title: string;        // 新闻标题
  summary: string;      // 新闻摘要
  url: string;          // 新闻链接
  source: string;       // 新闻来源
  publishTime: string;  // 发布时间
  keywords: string[];   // 关键词列表
}
```

---

## 🚀 快速开始

### 1. 环境配置

```bash
# 复制环境变量模板
cp ../.env.example .env

# 编辑 .env 文件，填入你的 Tushare Token
# TUSHARE_TOKEN=your_token_here
```

### 2. 安装依赖

```bash
# 在项目根目录
cd ..
npm install

# 构建项目
npm run build
```

### 3. 运行示例

```bash
# 运行 Tushare 热点新闻示例
npx tsx demo/1-tushare-hot-news.ts

# 运行百度新闻搜索示例
npx tsx demo/2-baidu-news-search.ts

# 运行完整财经新闻搜索示例
npx tsx demo/3-finance-news-complete.ts
```

---

## 📈 性能特点

### Tushare 热点新闻
- **速度**: 快（直接API调用）
- **数据量**: 大（单次可获取1500条）
- **时效性**: 高（实时数据）
- **成本**: 需要 Tushare Token

### 百度新闻搜索
- **速度**: 中等（需要爬取和解析HTML）
- **数据量**: 中等（单次约15条）
- **时效性**: 高（搜索引擎索引的最新数据）
- **成本**: 免费（可能受反爬限制）

---

## 🔒 注意事项

1. **Tushare Token**: 使用 Tushare 接口需要注册账号并获取 Token
2. **请求频率**: 注意控制请求频率，避免被限流
3. **爬虫限制**: 百度新闻爬虫可能受到反爬机制限制，建议合理使用
4. **超时设置**: 默认超时15-30秒，可根据网络情况调整
5. **错误处理**: 所有方法都有完善的错误处理和日志记录

---

## 📚 相关文档

- [Tushare API 文档](https://tushare.pro/document/2)
- [项目主 README](../README.md)
- [部署模式说明](../DEPLOYMENT_MODES.md)

---

## 🤝 贡献

如果你有新的新闻源或改进建议，欢迎提交 PR！

---

## 📄 许可证

本项目遵循主项目的许可证条款。
