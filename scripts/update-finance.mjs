import { readFileSync, writeFileSync } from 'fs';

const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

if (!AI_API_KEY) { console.error('AI_API_KEY is required'); process.exit(1); }

const now = new Date();
const bj = new Date(now.getTime() + 8 * 3600000);
const dateStr = bj.toISOString().slice(0, 10);

const FUNDS = [
  { id: 'f1', code: '016453', name: '南方纳斯达克100指数发起(QDII)C' },
  { id: 'f2', code: '019441', name: '万家纳斯达克100指数发起式(QDII)A' },
  { id: 'f3', code: '018147', name: '建信新兴市场混合(QDII)C' },
  { id: 'f4', code: '001513', name: '易方达信息产业混合A' }
];

const prompt = `Today is ${dateStr}. Generate fund-related news and analysis for a personal dashboard.

Funds in portfolio:
- f1: 南方纳斯达克100指数发起(QDII)C (016453) - tracks NASDAQ 100
- f2: 万家纳斯达克100指数发起式(QDII)A (019441) - tracks NASDAQ 100
- f3: 建信新兴市场混合(QDII)C (018147) - emerging markets
- f4: 易方达信息产业混合A (001513) - China TMT/info industry

Return ONLY valid JSON (no markdown):

{
  "news": [
    {"id":"n1","fund":"f1,f2","title":"","date":"${dateStr}","impact":"pos|neg|neu","duration":"short|mid","detail":"","related":"","source":""}
  ],
  "alertRisk": "portfolio risk alert text, 1-2 sentences",
  "alertEvent": "today's key event to watch, 1-2 sentences"
}

Rules:
- 6-8 news items, each linked to relevant fund IDs (comma-separated)
- impact: pos=positive, neg=negative, neu=neutral
- duration: short=short-term, mid=mid-to-long-term
- Focus on: US tech stocks, NASDAQ 100, USD/CNY exchange rate, emerging markets, China TMT policy, Fed meetings, fund company announcements
- All content in Chinese
- Be specific and factual, avoid speculation
- Do not give buy/sell advice
- source: cite where the info would come from (e.g. "美联储公告 / 各财经媒体")`;

async function callAI() {
  console.log('Calling AI API for finance content...');
  const res = await fetch(AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'system', content: 'You are a fund analysis assistant. Always return valid JSON.' }, { role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 4000
    })
  });
  if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,"\\'");
}

async function main() {
  console.log(`Generating finance content for ${dateStr}`);
  const content = await callAI();
  console.log('AI response received, updating HTML...');

  let html = readFileSync('index.html', 'utf8');

  // Replace finNewsData array
  const newsItems = (content.news || []).map(n => {
    return `      { id: '${esc(n.id)}', fund: '${esc(n.fund)}', title: '${esc(n.title)}', date: '${esc(n.date)}', impact: '${esc(n.impact)}', duration: '${esc(n.duration)}', detail: '${esc(n.detail)}', related: '${esc(n.related)}', source: '${esc(n.source)}' }`;
  }).join(',\n');

  const newsArrayStr = `    var finNewsData = [\n${newsItems}\n    ];`;

  html = html.replace(
    /var finNewsData = \[[\s\S]*?\];/,
    newsArrayStr
  );

  // Replace alert risk text
  html = html.replace(
    /(var riskEl = document\.getElementById\('fin-alert-risk'\);\s*\n\s*if \(riskEl\) riskEl\.innerHTML = ')[^']*(')/,
    `$1<span class="fin-alert-label">持仓提醒</span>${esc(content.alertRisk)}$2`
  );

  // Replace alert event text
  html = html.replace(
    /(var eventEl = document\.getElementById\('fin-alert-event'\);\s*\n\s*if \(eventEl\) eventEl\.innerHTML = ')[^']*(')/,
    `$1<span class="fin-alert-label">今日关注</span>${esc(content.alertEvent)}$2`
  );

  // Update finance data source text
  html = html.replace(
    /if \(srcEl\) srcEl\.textContent = '[^']*'/,
    `if (srcEl) srcEl.textContent = '数据来源：东方财富 API 实时拉取 | AI 分析更新：${dateStr} ${bj.toISOString().slice(11, 16)}'`
  );

  writeFileSync('index.html', html);
  console.log('Finance content updated successfully');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
