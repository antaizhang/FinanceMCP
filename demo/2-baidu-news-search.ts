/**
 * Demo 2: 百度新闻搜索示例
 *
 * 功能说明:
 * - 通过爬取百度新闻搜索页面获取新闻
 * - 支持多关键词搜索
 * - 提取完整信息：标题、摘要、链接、来源、发布时间
 * - 双重解析策略保证稳定性
 *
 * 运行方式:
 * npx tsx demo/2-baidu-news-search.ts
 */

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
// 工具函数
// ============================================

/**
 * 检查内容是否包含关键词（OR逻辑）
 */
function containsKeywords(content: string, searchQuery: string): boolean {
  const keywords = searchQuery.split(' ').filter(k => k.trim().length > 0);
  const lowerContent = content.toLowerCase();

  return keywords.some(keyword =>
    lowerContent.includes(keyword.toLowerCase())
  );
}

// ============================================
// HTML 解析函数
// ============================================

/**
 * 从单个百度新闻区块中提取完整信息
 */
function extractNewsFromBaiduItem(itemHtml: string, searchQuery: string): NewsItem | null {
  try {
    // 标题和链接通常在 h3 > a 标签中
    const titleMatch = itemHtml.match(/<h3[^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a><\/h3>/);

    // 摘要信息
    const summaryMatch = itemHtml.match(/<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([^<]+(?:<br\s*\/?>[^<]+)*)<\/div>/);

    // 时间信息
    const timeMatch = itemHtml.match(/<span[^>]*class="[^"]*c-color-gray2[^"]*"[^>]*aria-label="发布于：([^"]*)"[^>]*>([^<]*)<\/span>/);

    if (titleMatch && titleMatch[1] && titleMatch[2]) {
      const url = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();

      // 摘要是可选的，默认为标题
      let summary = title;
      if (summaryMatch && summaryMatch[1]) {
        summary = summaryMatch[1].replace(/<br\s*\/?>/g, ' ').replace(/<[^>]*>/g, '').trim();
      }

      // 时间也是可选的
      const time = timeMatch ? timeMatch[2].trim() : '';

      // 必须有标题和链接，且包含关键词
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
    console.error('解析百度新闻项出错:', error);
  }

  return null;
}

/**
 * 解析百度新闻页面内容
 */
function parseBaiduNews(html: string, searchQuery: string): NewsItem[] {
  const newsItems: NewsItem[] = [];

  try {
    // 策略1: 查找所有新闻结果的容器区块(div.result)
    const newsBlockRegex = /<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>(.*?)<\/div>/gs;
    const blockMatches = html.match(newsBlockRegex);

    if (blockMatches) {
      console.log(`  找到 ${blockMatches.length} 个新闻区块`);
      for (const blockHtml of blockMatches) {
        const newsItem = extractNewsFromBaiduItem(blockHtml, searchQuery);
        if (newsItem && newsItems.length < 15) {
          // 检查重复，避免添加相同的文章
          if (!newsItems.some(item => item.title === newsItem.title)) {
            newsItems.push(newsItem);
          }
        }
      }
    }

    // 如果主策略未找到任何新闻，则启用备用策略
    if (newsItems.length === 0) {
      console.log("  主策略未找到新闻，启用备用策略...");
      // 备用策略: 查找包含新闻标题的h3标签
      const titleRegex = /<h3[^>]*class="[^"]*t"[^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a><\/h3>/g;
      let titleMatch;
      while ((titleMatch = titleRegex.exec(html)) !== null && newsItems.length < 15) {
        const url = titleMatch[1];
        const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
        if (title && url && containsKeywords(title, searchQuery)) {
          newsItems.push({
            title: title,
            summary: title,
            url: url,
            source: '百度新闻',
            publishTime: '未知时间',
            keywords: searchQuery.split(' ').filter(k => k.trim().length > 0)
          });
        }
      }
    }

  } catch (error) {
    console.error('百度新闻页面解析出错:', error);
  }

  return newsItems;
}

// ============================================
// 百度新闻搜索
// ============================================

/**
 * 搜索百度新闻
 * @param keywords 关键词数组
 */
async function searchBaiduNews(keywords: string[]): Promise<NewsItem[]> {
  try {
    // 将所有关键词用空格连接，支持多关键词搜索
    const searchQuery = keywords.join(' ');
    console.log(`\n🔍 正在搜索百度新闻关键词: "${searchQuery}"`);

    // 百度新闻搜索URL
    const encodedQuery = encodeURIComponent(searchQuery);
    const baiduUrl = `https://www.baidu.com/s?rtt=1&bsst=1&cl=2&tn=news&ie=utf-8&word=${encodedQuery}`;

    console.log(`  请求URL: ${baiduUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(baiduUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.baidu.com/'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`百度新闻请求失败: ${response.status}`);
    }

    const html = await response.text();
    console.log(`  百度新闻页面HTML长度: ${html.length}`);

    // 解析百度新闻页面内容
    const newsItems = parseBaiduNews(html, searchQuery);

    console.log(`✅ 百度新闻解析完成，共获得 ${newsItems.length} 条新闻`);
    return newsItems;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ 百度新闻搜索超时');
    } else {
      console.error('❌ 百度新闻搜索出错:', error);
    }
    return [];
  }
}

// ============================================
// 格式化输出
// ============================================

/**
 * 格式化新闻列表
 */
function formatNews(news: NewsItem[]): string {
  if (news.length === 0) {
    return '暂无新闻数据';
  }

  return news.map((n, idx) => {
    return `${idx + 1}. ${n.title}
   来源: ${n.source}  时间: ${n.publishTime}
   摘要: ${n.summary}
   链接: ${n.url}`;
  }).join('\n\n' + '-'.repeat(60) + '\n\n');
}

// ============================================
// 主函数
// ============================================

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('百度新闻搜索示例');
    console.log('='.repeat(60));

    // 示例1: 单关键词搜索
    console.log('\n【示例1】单关键词搜索: "比特币"');
    const news1 = await searchBaiduNews(['比特币']);
    console.log('\n结果:');
    console.log(formatNews(news1.slice(0, 5))); // 只显示前5条

    // 示例2: 多关键词搜索
    console.log('\n' + '='.repeat(60));
    console.log('\n【示例2】多关键词搜索: "美联储 加息"');
    const news2 = await searchBaiduNews(['美联储', '加息']);
    console.log('\n结果:');
    console.log(formatNews(news2.slice(0, 5)));

    // 示例3: 股票相关搜索
    console.log('\n' + '='.repeat(60));
    console.log('\n【示例3】股票相关搜索: "药明康德"');
    const news3 = await searchBaiduNews(['药明康德']);
    console.log('\n结果:');
    console.log(formatNews(news3.slice(0, 5)));

    // 统计
    console.log('\n' + '='.repeat(60));
    console.log('统计信息');
    console.log('='.repeat(60));
    console.log(`示例1 获取条数: ${news1.length}`);
    console.log(`示例2 获取条数: ${news2.length}`);
    console.log(`示例3 获取条数: ${news3.length}`);
    console.log(`总计: ${news1.length + news2.length + news3.length} 条`);

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
  searchBaiduNews,
  parseBaiduNews,
  extractNewsFromBaiduItem,
  containsKeywords,
  formatNews
};
