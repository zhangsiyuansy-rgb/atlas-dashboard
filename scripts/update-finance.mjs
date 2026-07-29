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

const prompt = `Today is ${dateStr}. Generate fund news, buy/sell/hold recommendations and Buffett framework analysis for a personal dashboard.

Funds in portfolio:
- f1: 南方纳斯达克100指数发起(QDII)C (016453) - tracks NASDAQ 100
- f2: 万家纳斯达克100指数发起式(QDII)A (019441) - tracks NASDAQ 100 (same index as f1)
- f3: 建信新兴市场混合(QDII)C (018147) - emerging markets (MSCI Emerging Markets)
- f4: 易方达信息产业混合A (001513) - China TMT/info industry

Return ONLY valid JSON (no markdown, no code fences):

{
  "news": [
    {"id":"n1","fund":"f1,f2","title":"...","date":"${dateStr}","impact":"pos|neg|neu","duration":"short|mid","detail":"...","related":"...","source":"..."}
  ],
  "alertRisk": "1-2 sentences in Chinese about portfolio risk",
  "alertEvent": "1-2 sentences in Chinese about key events to watch today",
  "recommendations": {
    "f1": {"action":"hold","title":"持有/不动","reason":"detailed analysis in Chinese","framework":"4-part framework in Chinese"},
    "f2": {"action":"hold","title":"持有/不追加","reason":"...","framework":"..."},
    "f3": {"action":"buy","title":"可小幅加仓","reason":"...","framework":"..."},
    "f4": {"action":"buy","title":"分批买入","reason":"...","framework":"..."}
  },
  "buffettFramework": {
    "items": [
      {"name":"市场先生 Mr. Market","text":"1-2 sentences covering all 4 funds"},
      {"name":"恐惧与贪婪","text":"1-2 sentences covering all 4 funds"},
      {"name":"安全边际","text":"1-2 sentences covering all 4 funds"},
      {"name":"永久持有","text":"1-2 sentences covering all 4 funds"}
    ]
  }
}

Recommendation rules:
- action: one of hold|buy|sell|watch
- title: very short Chinese label (max 8 chars)
- reason: 3-5 sentences in Chinese. Be specific. Mention Buffett framework concepts (Mr. Market, margin of safety, fear & greed, circle of competence, hold forever). End with a clear conclusion.
- framework: pipe-separated framework analysis, e.g. "市场先生：... | 恐惧贪婪：... | 安全边际：... | 永久持有：..."
- buffettFramework.items.text: each 1-2 sentences analyzing ALL four funds together through that lens

News rules:
- 6-8 items, each linked to one or more fund IDs
- impact: pos=positive, neg=negative, neu=neutral
- duration: short=short-term, mid=mid-to-long-term
- Focus on: US tech stocks, NASDAQ 100, USD/CNY exchange rate, emerging markets, China TMT policy, Fed, AI capex
- All in Chinese, be specific and factual
- source: cite the info source`;

async function callAI() {
  console.log('Calling AI API for finance content...');
  const res = await fetch(AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: 'You are a value investing analyst following Buffett principles. Always return valid JSON with no markdown formatting.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 6000
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

  // 1. Replace finNewsData array
  const newsItems = (content.news || []).map(n => {
    return `      { id: '${esc(n.id)}', fund: '${esc(n.fund)}', title: '${esc(n.title)}', date: '${esc(n.date)}', impact: '${esc(n.impact)}', duration: '${esc(n.duration)}', detail: '${esc(n.detail)}', related: '${esc(n.related)}', source: '${esc(n.source)}' }`;
  }).join(',\n');
  html = html.replace(/var finNewsData = \[[\s\S]*?\];/, `    var finNewsData = [\n${newsItems}\n    ];`);
  console.log('  - News data replaced');

  // 2. Replace alert risk text
  html = html.replace(
    /(var riskEl = document\.getElementById\('fin-alert-risk'\);\s*\n\s*if \(riskEl\) riskEl\.innerHTML = ')[^']*(')/,
    `$1<span class="fin-alert-label">持仓提醒</span>${esc(content.alertRisk)}$2`
  );
  console.log('  - Risk alert replaced');

  // 3. Replace alert event text
  html = html.replace(
    /(var eventEl = document\.getElementById\('fin-alert-event'\);\s*\n\s*if \(eventEl\) eventEl\.innerHTML = ')[^']*(')/,
    `$1<span class="fin-alert-label">今日关注</span>${esc(content.alertEvent)}$2`
  );
  console.log('  - Event alert replaced');

  // 4. Replace each fund's recommendation block (anchor by unique URL)
  const recs = content.recommendations || {};
  if (recs.f1) {
    const r = recs.f1;
    const before = html;
    html = html.replace(
      /(url: 'https:\/\/www\.nffund\.com\/main\/jjcp\/fundproduct\/016453\.shtml', status: 'hold', custom: false,\n\s*)recommendation: \{[\s\S]*?\n        \}/,
      `$1recommendation: {\n          action: '${esc(r.action)}', title: '${esc(r.title)}',\n          reason: '${esc(r.reason)}',\n          framework: '${esc(r.framework)}'\n        }`
    );
    if (html === before) console.warn('  - WARNING: f1 recommendation regex did NOT match');
    else console.log('  - f1 recommendation replaced');
  }
  if (recs.f2) {
    const r = recs.f2;
    const before = html;
    html = html.replace(
      /(url: 'https:\/\/www\.wjasset\.com\/products\/qdii\/019441\/', status: 'hold', custom: false,\n\s*)recommendation: \{[\s\S]*?\n        \}/,
      `$1recommendation: {\n          action: '${esc(r.action)}', title: '${esc(r.title)}',\n          reason: '${esc(r.reason)}',\n          framework: '${esc(r.framework)}'\n        }`
    );
    if (html === before) console.warn('  - WARNING: f2 recommendation regex did NOT match');
    else console.log('  - f2 recommendation replaced');
  }
  if (recs.f3) {
    const r = recs.f3;
    const before = html;
    html = html.replace(
      /(url: 'https:\/\/www\.ccbfund\.cn\/', status: 'hold', custom: false,\n\s*)recommendation: \{[\s\S]*?\n        \}/,
      `$1recommendation: {\n          action: '${esc(r.action)}', title: '${esc(r.title)}',\n          reason: '${esc(r.reason)}',\n          framework: '${esc(r.framework)}'\n        }`
    );
    if (html === before) console.warn('  - WARNING: f3 recommendation regex did NOT match');
    else console.log('  - f3 recommendation replaced');
  }
  if (recs.f4) {
    const r = recs.f4;
    const before = html;
    html = html.replace(
      /(url: 'https:\/\/www\.efunds\.com\.cn\/fund\/001513\.shtml', status: 'hold', custom: false,\n\s*)recommendation: \{[\s\S]*?\n        \}/,
      `$1recommendation: {\n          action: '${esc(r.action)}', title: '${esc(r.title)}',\n          reason: '${esc(r.reason)}',\n          framework: '${esc(r.framework)}'\n        }`
    );
    if (html === before) console.warn('  - WARNING: f4 recommendation regex did NOT match');
    else console.log('  - f4 recommendation replaced');
  }

  // 5. Replace Buffett framework HTML in JS
  if (content.buffettFramework && content.buffettFramework.items) {
    const items = content.buffettFramework.items;
    const bfHtml = items.map(i =>
      `'<div class="buffett-item"><strong>${esc(i.name)}</strong>${esc(i.text)}</div>'`
    ).join(' +\n          ');
    const before = html;
    html = html.replace(
      /(bfEl\.innerHTML = ')<div class="buffett-title">[^']*<\/div>' \+\n\s*'<div class="buffett-grid">' \+\n[\s\S]*?'<\/div>';/,
      `$1<div class="buffett-title">巴菲特投资框架分析（基于 buffett-letters-skill）</div>' +\n          '<div class="buffett-grid">' +\n          ${bfHtml} +\n          '</div>';`
    );
    if (html === before) console.warn('  - WARNING: buffett framework regex did NOT match');
    else console.log('  - Buffett framework replaced');
  }

  // 6. Update finance data source text
  html = html.replace(
    /if \(srcEl\) srcEl\.textContent = '[^']*'/,
    `if (srcEl) srcEl.textContent = '数据来源：东方财富 API 实时拉取 | AI 分析更新：${dateStr} ${bj.toISOString().slice(11, 16)}'`
  );
  console.log('  - Data source text updated');

  writeFileSync('index.html', html);
  console.log('Finance content + recommendations updated successfully');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });