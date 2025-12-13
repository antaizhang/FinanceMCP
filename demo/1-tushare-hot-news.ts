/**
 * Demo 1: Tushare 7x24 热点新闻示例
 *
 * 功能说明:
 * - 从 Tushare API 获取最新的综合新闻（财经、政治、科技、体育、娱乐、军事、社会、国际等）
 * - 使用 Jaccard 相似度算法进行内容去重
 * - 支持自定义返回条数
 *
 * 运行方式:
 * npx tsx demo/1-tushare-hot-news.ts
 */

import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || '';
const TUSHARE_API_URL = 'https://api.tushare.pro';
const TIMEOUT = 30000;

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
// 文本处理工具函数
// ============================================

/**
 * 规范化文本：去除HTML标签和多余空格
 */
function normalizeText(text: string): string {
  return (text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\s\u3000]+/g, '')
    .toLowerCase();
}

/**
 * 生成文本的bigram（2字切分）
 */
function toBigrams(text: string): string[] {
  const s = normalizeText(text);
  const grams: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    grams.push(s.slice(i, i + 2));
  }
  return grams.length ? grams : s ? [s] : [];
}

/**
 * 计算两个集合的 Jaccard 相似度
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const g of setA) if (setB.has(g)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * 判断两个文本是否相似
 */
function isSimilar(a: string, b: string, threshold: number): boolean {
  const sim = jaccard(toBigrams(a), toBigrams(b));
  return sim >= threshold;
}

/**
 * 基于内容相似度去重
 * @param items 新闻列表
 * @param threshold 相似度阈值（0-1），默认0.8
 */
function deduplicateByContent(items: NewsItem[], threshold = 0.8): NewsItem[] {
  const representatives: NewsItem[] = [];
  for (const item of items) {
    const content = `${item.title}\n${item.summary}`;
    let dup = false;
    for (const rep of representatives) {
      const repContent = `${rep.title}\n${rep.summary}`;
      if (isSimilar(content, repContent, threshold)) {
        dup = true;
        break;
      }
    }
    if (!dup) representatives.push(item);
  }
  return representatives;
}

// ============================================
// Tushare API 调用
// ============================================

/**
 * 从 Tushare API 获取新闻
 * @param maxTotal 最大获取条数
 */
async function fetchTushareNews(maxTotal: number): Promise<NewsItem[]> {
  if (!TUSHARE_TOKEN) {
    throw new Error('未配置 TUSHARE_TOKEN 环境变量');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const body = {
      api_name: 'news',
      token: TUSHARE_TOKEN,
      params: {},
      fields: 'datetime,content,title,channels'
    };

    console.log(`正在从 Tushare 获取新闻...`);

    const resp = await fetch(TUSHARE_API_URL, {
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
      throw new Error(`Tushare 返回错误: ${data.msg || data.message || '未知错误'}`);
    }

    const fields: string[] = data.data?.fields ?? [];
    const items: any[][] = data.data?.items ?? [];

    const idxDatetime = fields.indexOf('datetime');
    const idxContent = fields.indexOf('content');
    const idxTitle = fields.indexOf('title');

    const results: NewsItem[] = [];

    for (const row of items) {
      if (results.length >= maxTotal) break;

      const title = String(row[idxTitle] ?? '').trim();
      const content = String(row[idxContent] ?? '').trim();
      const datetime = String(row[idxDatetime] ?? '').trim();

      results.push({
        title,
        summary: content,
        url: '',
        source: 'Tushare',
        publishTime: datetime,
        keywords: []
      });
    }

    console.log(`从 Tushare 获取原始条数: ${results.length}`);
    return results;

  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ============================================
// 格式化输出
// ============================================

/**
 * 格式化新闻列表为可读文本
 */
function formatNews(news: NewsItem[]): string {
  if (news.length === 0) {
    return '暂无新闻数据';
  }

  const formattedList = news.map((n, idx) => {
    const title = n.title ? `${n.title}\n` : '';
    return `${idx + 1}. ${title}${n.summary}`.trim();
  }).join('\n\n---\n\n');

  // 统计信息
  const sourceCounts = new Map<string, number>();
  const daySet = new Set<string>();

  for (const n of news) {
    sourceCounts.set(n.source, (sourceCounts.get(n.source) || 0) + 1);
    const day = (n.publishTime || '').split(' ')[0] || '';
    if (day) daySet.add(day);
  }

  const sourceStats = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([s, c]) => `${s}: ${c}`)
    .join('，');

  const uniqueDays = Array.from(daySet.values()).sort();
  const dayInfo = uniqueDays.length ? `日期：${uniqueDays.join('、')}` : `日期：未知`;

  const footer = `\n\n${'='.repeat(60)}\n统计：共 ${news.length} 条\n来源分布：${sourceStats || '无'}\n${dayInfo}\n数据来源：Tushare 新闻快讯 (https://tushare.pro/document/2?doc_id=143)`;

  return formattedList + footer;
}

// ============================================
// 主函数
// ============================================

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Tushare 7x24 热点新闻示例');
    console.log('='.repeat(60));
    console.log();

    // 获取新闻（默认100条）
    const limit = 100;
    console.log(`📰 获取最新 ${limit} 条新闻...\n`);

    const rawNews = await fetchTushareNews(limit);

    // 去重
    console.log(`🔍 使用 Jaccard 相似度算法去重（阈值: 0.8）...\n`);
    const dedupedNews = deduplicateByContent(rawNews, 0.8);
    console.log(`去重后条数: ${dedupedNews.length}\n`);

    // 输出结果
    console.log('='.repeat(60));
    console.log('新闻列表');
    console.log('='.repeat(60));
    console.log();
    console.log(formatNews(dedupedNews));
    console.log();

    // 示例：调整去重阈值
    console.log('\n' + '='.repeat(60));
    console.log('调整去重阈值示例（阈值: 0.9 - 更严格）');
    console.log('='.repeat(60));
    const strictDeduped = deduplicateByContent(rawNews, 0.9);
    console.log(`\n严格去重后条数: ${strictDeduped.length}`);

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
  fetchTushareNews,
  deduplicateByContent,
  normalizeText,
  toBigrams,
  jaccard,
  isSimilar,
  formatNews
};
