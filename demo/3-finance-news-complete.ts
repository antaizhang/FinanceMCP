/**
 * Demo 3: 完整财经新闻搜索示例
 *
 * 功能说明:
 * - 整合多个新闻源（Tushare + 百度新闻）
 * - 支持单个或多个关键词智能搜索
 * - 自动去重和结果合并
 * - 提供完整的搜索流程和错误处理
 *
 * 运行方式:
 * npx tsx demo/3-finance-news-complete.ts
 */

import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || '';

// ============================================
// 数据结构定义
// ============================================

interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishTime: string;
  keywords: string[];
}

// ============================================
// 去重工具函数
// ============================================

/**
 * 去重：基于标题+来源
 */
function removeDuplicates(news: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return news.filter(item => {
    const key = item.title + item.source;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// ============================================
// 百度新闻搜索（简化版）
// ============================================

function containsKeywords(content: string, searchQuery: string): boolean {
  const keywords = searchQuery.split(' ').filter(k => k.trim().length > 0);
  const lowerContent = content.toLowerCase();
  return keywords.some(keyword =>
    lowerContent.includes(keyword.toLowerCase())
  );
}

function extractNewsFromBaiduItem(itemHtml: string, searchQuery: string): NewsItem | null {
  try {
    const titleMatch = itemHtml.match(/<h3[^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a><\/h3>/);
    const summaryMatch = itemHtml.match(/<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([^<]+(?:<br\s*\/?>[^<]+)*)<\/div>/);
    const timeMatch = itemHtml.match(/<span[^>]*class="[^"]*c-color-gray2[^"]*"[^>]*aria-label="发布于：([^"]*)"[^>]*>([^<]*)<\/span>/);

    if (titleMatch && titleMatch[1] && titleMatch[2]) {
      const url = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
      let summary = title;
      if (summaryMatch && summaryMatch[1]) {
        summary = summaryMatch[1].replace(/<br\s*\/?>/g, ' ').replace(/<[^>]*>/g, '').trim();
      }
      const time = timeMatch ? timeMatch[2].trim() : '';

      if (title && url && containsKeywords(title + summary, searchQuery)) {
        return {
          title,
          summary,
          url: url,
          source: '百度新闻',
          publishTime: time || '未知时间',
          keywords: searchQuery.split(' ').filter(k => k.trim().length > 0)
        };
      }
    }
  } catch (error) {
    // 忽略解析错误
  }
  return null;
}

function parseBaiduNews(html: string, searchQuery: string): NewsItem[] {
  const newsItems: NewsItem[] = [];
  const newsBlockRegex = /<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>(.*?)<\/div>/gs;
  const blockMatches = html.match(newsBlockRegex);

  if (blockMatches) {
    for (const blockHtml of blockMatches) {
      const newsItem = extractNewsFromBaiduItem(blockHtml, searchQuery);
      if (newsItem && newsItems.length < 15) {
        if (!newsItems.some(item => item.title === newsItem.title)) {
          newsItems.push(newsItem);
        }
      }
    }
  }

  return newsItems;
}

async function searchBaiduNews(keywords: string[]): Promise<NewsItem[]> {
  try {
    const searchQuery = keywords.join(' ');
    const encodedQuery = encodeURIComponent(searchQuery);
    const baiduUrl = `https://www.baidu.com/s?rtt=1&bsst=1&cl=2&tn=news&ie=utf-8&word=${encodedQuery}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(baiduUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.baidu.com/'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`百度新闻请求失败: ${response.status}`);
    }

    const html = await response.text();
    return parseBaiduNews(html, searchQuery);

  } catch (error) {
    console.error('百度新闻搜索失败:', error);
    return [];
  }
}

// ============================================
// Tushare 新闻搜索（可选）
// ============================================

async function searchTushareNews(keywords: string[]): Promise<NewsItem[]> {
  if (!TUSHARE_TOKEN) {
    console.log('未配置 TUSHARE_TOKEN，跳过 Tushare 新闻源');
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const body = {
      api_name: 'news',
      token: TUSHARE_TOKEN,
      params: {},
      fields: 'datetime,content,title,channels'
    };

    const resp = await fetch('https://api.tushare.pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`Tushare 请求失败: HTTP ${resp.status}`);
    }

    const data = await resp.json();

    if (data.code !== 0) {
      throw new Error(`Tushare 返回错误: ${data.msg || '未知错误'}`);
    }

    const fields: string[] = data.data?.fields ?? [];
    const items: any[][] = data.data?.items ?? [];

    const idxDatetime = fields.indexOf('datetime');
    const idxContent = fields.indexOf('content');
    const idxTitle = fields.indexOf('title');

    const results: NewsItem[] = [];

    // 过滤包含关键词的新闻
    const searchQuery = keywords.join(' ');
    for (const row of items) {
      const title = String(row[idxTitle] ?? '').trim();
      const content = String(row[idxContent] ?? '').trim();
      const datetime = String(row[idxDatetime] ?? '').trim();

      // 检查是否包含关键词
      if (containsKeywords(title + content, searchQuery)) {
        results.push({
          title,
          summary: content,
          url: '',
          source: 'Tushare',
          publishTime: datetime,
          keywords: keywords
        });
      }

      if (results.length >= 20) break;
    }

    return results;

  } catch (error) {
    console.error('Tushare 新闻搜索失败:', error);
    return [];
  }
}

// ============================================
// 综合新闻搜索
// ============================================

/**
 * 搜索财经新闻（整合多个新闻源）
 * @param query 搜索关键词，支持空格分隔多个词
 */
async function searchFinanceNews(query: string): Promise<NewsItem[]> {
  const keywords = query.split(' ').filter(k => k.trim().length > 0);

  console.log(`\n🔍 开始搜索财经新闻，关键词: ${keywords.join(', ')}`);
  console.log('─'.repeat(60));

  // 并发搜索多个新闻源
  const searchPromises = [
    searchBaiduNews(keywords),
    searchTushareNews(keywords)
  ];

  const news: NewsItem[] = [];

  try {
    const results = await Promise.allSettled(searchPromises);
    const sourceNames = ['百度新闻', 'Tushare'];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        news.push(...result.value);
        console.log(`✅ ${sourceNames[index]} 搜索成功，获得 ${result.value.length} 条新闻`);
      } else {
        console.log(`❌ ${sourceNames[index]} 搜索失败:`, result.reason);
      }
    });

    // 去重
    const uniqueNews = removeDuplicates(news);
    console.log(`\n📊 去重前: ${news.length} 条，去重后: ${uniqueNews.length} 条`);

    return uniqueNews.slice(0, 20); // 最多返回20条

  } catch (error) {
    console.error('并发搜索时发生错误:', error);
    return [];
  }
}

// ============================================
// 格式化输出
// ============================================

/**
 * 格式化新闻列表
 */
function formatNews(news: NewsItem[], query: string): string {
  if (news.length === 0) {
    return `# ${query} 财经新闻搜索结果\n\n未找到相关财经新闻`;
  }

  const formattedNews = news.map((n, idx) => {
    return `${idx + 1}. ${n.title}
   来源: ${n.source}  时间: ${n.publishTime}
   摘要: ${n.summary}${n.url ? `\n   链接: ${n.url}` : ''}`;
  }).join('\n\n' + '─'.repeat(60) + '\n\n');

  // 统计信息
  const sourceCount = news.reduce((acc, n) => {
    acc[n.source] = (acc[n.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stats = Object.entries(sourceCount)
    .map(([source, count]) => `${source}: ${count}`)
    .join(', ');

  return `# ${query} 财经新闻搜索结果\n\n${formattedNews}\n\n${'='.repeat(60)}\n统计: 共 ${news.length} 条 | 来源分布: ${stats}`;
}

// ============================================
// 主函数
// ============================================

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('完整财经新闻搜索示例');
    console.log('='.repeat(60));

    // 示例1: 单关键词搜索
    console.log('\n【示例1】搜索: "腾讯"');
    const news1 = await searchFinanceNews('腾讯');
    console.log('\n' + formatNews(news1.slice(0, 5), '腾讯'));

    // 示例2: 多关键词搜索
    console.log('\n\n' + '='.repeat(60));
    console.log('\n【示例2】搜索: "美联储 加息"');
    const news2 = await searchFinanceNews('美联储 加息');
    console.log('\n' + formatNews(news2.slice(0, 5), '美联储 加息'));

    // 示例3: 股票代码搜索
    console.log('\n\n' + '='.repeat(60));
    console.log('\n【示例3】搜索: "药明康德"');
    const news3 = await searchFinanceNews('药明康德');
    console.log('\n' + formatNews(news3.slice(0, 5), '药明康德'));

    // 示例4: 热点事件搜索
    console.log('\n\n' + '='.repeat(60));
    console.log('\n【示例4】搜索: "比特币 监管"');
    const news4 = await searchFinanceNews('比特币 监管');
    console.log('\n' + formatNews(news4.slice(0, 5), '比特币 监管'));

    // 总结
    console.log('\n\n' + '='.repeat(60));
    console.log('搜索总结');
    console.log('='.repeat(60));
    console.log(`示例1 (腾讯): ${news1.length} 条`);
    console.log(`示例2 (美联储 加息): ${news2.length} 条`);
    console.log(`示例3 (药明康德): ${news3.length} 条`);
    console.log(`示例4 (比特币 监管): ${news4.length} 条`);
    console.log(`总计: ${news1.length + news2.length + news3.length + news4.length} 条`);

    console.log('\n✅ 所有示例执行完成！');

  } catch (error) {
    console.error('❌ 错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// 导出函数供其他模块使用
export {
  searchFinanceNews,
  searchBaiduNews,
  searchTushareNews,
  removeDuplicates,
  formatNews
};
