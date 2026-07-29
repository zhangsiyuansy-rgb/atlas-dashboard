import { readFileSync, writeFileSync } from 'fs';

const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

if (!AI_API_KEY) { console.error('AI_API_KEY is required'); process.exit(1); }

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const now = new Date();
const bj = new Date(now.getTime() + 8 * 3600000);
const dateStr = bj.toISOString().slice(0, 10);
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dayName = dayNames[bj.getUTCDay()];
const isWeekend = bj.getUTCDay() === 0 || bj.getUTCDay() === 6;
const directions = ['Brand Marketing','Consumer Insight','Digital Marketing','AI Product Marketing'];
const dayOfYear = Math.floor((bj - new Date(Date.UTC(bj.getUTCFullYear(),0,0))) / 86400000);
const direction = directions[dayOfYear % 4];
const timeStr = bj.toISOString().slice(11, 16);

const prompt = `Today is ${dateStr} (${dayName}). ${isWeekend ? 'Weekend.' : 'Weekday.'}

Generate content for a personal daily dashboard in JSON. All content in Chinese except English Coach.

JSON structure (return ONLY valid JSON, no markdown):

{
  "headerMeta": "max 30 chars, market/trend summary, use · as separator",
  "morningBrief": {
    "china": [{"headline":"","what":"","why":"","impact":"","watch":""}],
    "international": [{"headline":"","what":"","why":"","impact":"","watch":""}],
    "finance": [{"headline":"","what":"","why":"","impact":"","watch":""}],
    "ai": [{"headline":"","what":"","why":"","impact":"","watch":""}],
    "opportunity": "today's biggest opportunity, 1-2 sentences",
    "risk": "today's biggest risk, 1-2 sentences"
  },
  "trends": {
    "xiaohongshu": [{"name":"","tag":"","heat":"","form":"","why":"","psychology":"","titles":"","accounts":"","brand":"","duration":"","follow":""}],
    "douyin": [{"name":"","tag":"","heat":"","form":"","why":"","psychology":"","titles":"","accounts":"","brand":"","duration":"","follow":""}],
    "observation": {"xhs":"","dy":"","contentLogic":"","marketing":"","creator":""}
  },
  "english": {
    "direction": "${direction}",
    "expressions": [{"phrase":"","cn":"","example":""}],
    "question": {"en":"","zh":""},
    "analysis": [{"key":"为什么问","val":""},{"key":"真正想看","val":""},{"key":"回答结构","val":""},{"key":"避免","val":""}],
    "rounds": [
      {"title":"第 1 轮 — 主问题","interviewerEn":"","interviewerCn":"","candidateEn":"","candidateCn":"","analysis":"","collectEn":"","collectCn":"","collectCtx":""},
      {"title":"第 2 轮 — 基于第一轮的追问","interviewerEn":"","interviewerCn":"","candidateEn":"","candidateCn":"","analysis":"","collectEn":"","collectCn":"","collectCtx":""},
      {"title":"第 3 轮 — 更深入的挑战性追问","interviewerEn":"","interviewerCn":"","candidateEn":"","candidateCn":"","analysis":"","collectEn":"","collectCn":"","collectCtx":""}
    ],
    "framework": "answer framework flow, use -> as separator",
    "replaceable": ["hint 1","hint 2","hint 3","hint 4","hint 5"],
    "evaluation": [{"key":"优点","type":"pos","val":""},{"key":"不足","type":"neg","val":""},{"key":"具体性","val":""},{"key":"个人贡献","val":""},{"key":"结果","val":""},{"key":"优化建议","val":""}]
  }
}

Rules:
- 2 news items per category (china, international, finance, ai)
- 3 trends per platform (xiaohongshu, douyin)
- Focus on ${isWeekend ? 'lifestyle, consumption trends, less market/finance' : 'current events, market moves, AI industry'}
- English Coach direction: ${direction}
- 2 business expressions, 1 interview question, 3 dialogue rounds
- Candidate answers should be 80-120 words each, realistic and specific
- No emojis, professional tone
- News should reflect plausible recent events and ongoing trends
- Trends: focus on consumption, lifestyle, brand marketing, AI tools, career, content creation. Avoid entertainment gossip`;

async function callAI() {
  console.log('Calling AI API...');
  const res = await fetch(AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'system', content: 'You are a content generator for a personal daily dashboard. Always return valid JSON.' }, { role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 10000
    })
  });
  if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

function renderNewsItem(item) {
  return `        <div class="news-item">
          <div class="news-headline">${esc(item.headline)}</div>
          <div class="news-line"><span class="nl-key">What</span>${esc(item.what)}</div>
          <div class="news-line"><span class="nl-key">Why</span>${esc(item.why)}</div>
          <div class="news-line"><span class="nl-key">Impact</span>${esc(item.impact)}</div>
          <div class="news-line"><span class="nl-key">Watch</span>${esc(item.watch)}</div>
        </div>`;
}

function renderCategory(label, items) {
  return `      <!-- ${label} -->
      <div>
        <div class="brief-cat-label">${label}</div>

${items.map(renderNewsItem).join('\n\n')}
      </div>`;
}

function renderTrendCard(t) {
  return `      <div class="trend-card">
        <div class="trend-header"><span class="trend-name">${esc(t.name)}</span><span class="trend-tag">${esc(t.tag)}</span></div>
        <div class="trend-heat">${esc(t.heat)}</div>
        <div class="trend-detail"><span class="td-key">内容形式</span><span class="td-val">${esc(t.form)}</span></div>
        <div class="trend-detail"><span class="td-key">为什么火</span><span class="td-val">${esc(t.why)}</span></div>
        <div class="trend-detail"><span class="td-key">用户心理</span><span class="td-val">${esc(t.psychology)}</span></div>
        <div class="trend-detail"><span class="td-key">常见标题</span><span class="td-val">${esc(t.titles)}</span></div>
        <div class="trend-detail"><span class="td-key">适合账号</span><span class="td-val">${esc(t.accounts)}</span></div>
        <div class="trend-detail"><span class="td-key">品牌借鉴</span><span class="td-val">${esc(t.brand)}</span></div>
        <div class="trend-detail"><span class="td-key">持续多久</span><span class="td-val">${esc(t.duration)}</span></div>
        <div class="trend-detail"><span class="td-key">值得跟进</span><span class="td-val">${esc(t.follow)}</span></div>
      </div>`;
}

function renderVocabRow(v) {
  return `      <div class="vocab-row">
        <div class="vocab-content">
          <div class="vocab-phrase">${esc(v.phrase)}</div>
          <div class="vocab-cn">${esc(v.cn)}</div>
          <div class="vocab-eg">"${esc(v.example)}"</div>
        </div>
        <button class="collect-btn" onclick="collectExpr(this)" data-en="${esc(v.phrase)}" data-cn="${esc(v.cn)}" data-src="商务表达" data-ctx="讨论${esc(direction)}">收藏</button>
      </div>`;
}

function renderDialogueRound(r) {
  return `      <!-- ${r.title.split('—')[0].trim()} -->
      <div class="dialogue-round">
        <div class="dr-header">${esc(r.title)}</div>
        <div class="dr-content">
          <div class="dialogue-text">
            <div class="dt-label">Interviewer</div>
            <div class="dt-en">${esc(r.interviewerEn)}</div>
            <div class="dt-cn">${esc(r.interviewerCn)}</div>
          </div>
          <div class="dialogue-text">
            <div class="dt-label">Candidate</div>
            <div class="dt-en">${esc(r.candidateEn)}</div>
            <div class="dt-cn">${esc(r.candidateCn)}</div>
            <button class="collect-btn" onclick="collectExpr(this)" data-en="${esc(r.collectEn)}" data-cn="${esc(r.collectCn)}" data-src="面试 ${esc(r.title.split('—')[0].trim())}" data-ctx="${esc(r.collectCtx)}">收藏句</button>
          </div>
          <div class="dialogue-text">
            <div class="dt-label">回答结构分析</div>
            <div class="dt-analysis">${esc(r.analysis)}</div>
          </div>
        </div>
      </div>`;
}

function renderEvalItem(e) {
  const cls = e.type === 'pos' ? ' pos' : e.type === 'neg' ? ' neg' : '';
  return `        <div class="eval-item"><span class="eval-key${cls}">${esc(e.key)}</span>${esc(e.val)}</div>`;
}

function replaceSection(html, startAnchor, endAnchor, newContent) {
  const regex = new RegExp('(' + startAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[\\s\\S]*?(' + endAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')');
  return html.replace(regex, '$1\n' + newContent + '\n    $2');
}

async function main() {
  console.log(`Generating content for ${dateStr} (${dayName})`);
  const content = await callAI();
  console.log('AI response received, rendering HTML...');

  let html = readFileSync('index.html', 'utf8');

  // Update header
  html = html.replace(/(<div class="header-date">)[^<]*(<\/div>)/, `$1${dateStr.replace(/-/g, '.')} — ${dayName}$2`);
  html = html.replace(/(<div class="header-meta">)[^<]*(<\/div>)/, `$1${esc(content.headerMeta)}$2`);
  html = html.replace(/(<div class="header-updated">)[^<]*(<\/div>)/, `$1Last updated ${timeStr} · Auto-refreshed via GitHub Actions$2`);

  // Morning Brief categories
  const cats = content.morningBrief;
  const catLabels = { china: 'China', international: 'International', finance: 'Finance', ai: 'AI' };
  const catHtml = Object.keys(catLabels).map(k => renderCategory(catLabels[k], cats[k] || [])).join('\n\n');
  html = replaceSection(html, '<div class="brief-categories">', '<!-- Summary -->',
    `\n${catHtml}\n    </div>\n\n    `);

  // Morning Brief summary
  const sumHtml = `      <div class="summary-item">
        <div class="summary-label opp">Today's Opportunity</div>
        <div class="summary-text">${esc(cats.opportunity)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label risk">Today's Risk</div>
        <div class="summary-text">${esc(cats.risk)}</div>
      </div>`;
  html = replaceSection(html, '<div class="brief-summary">', '</section>',
    `\n${sumHtml}\n    </div>\n  `);

  // Trend XHS
  const xhsHtml = (content.trends.xiaohongshu || []).map(renderTrendCard).join('\n\n');
  html = replaceSection(html, '<div class="tab-panel active" data-panel="xhs">', '<!-- 抖音热点 -->',
    `\n${xhsHtml}\n    </div>\n\n    `);

  // Trend DY
  const dyHtml = (content.trends.douyin || []).map(renderTrendCard).join('\n\n');
  html = replaceSection(html, '<div class="tab-panel" data-panel="dy">', '<!-- 平台观察 -->',
    `\n${dyHtml}\n    </div>\n\n    `);

  // Platform observation
  const obs = content.trends.observation || {};
  const obsHtml = `    <div class="platform-observation">
      <div class="po-title">今日平台观察</div>
      <div class="po-item"><span class="po-key">小红书</span>${esc(obs.xhs)}</div>
      <div class="po-item"><span class="po-key">抖音</span>${esc(obs.dy)}</div>
      <div class="po-item"><span class="po-key">内容逻辑</span>${esc(obs.contentLogic)}</div>
      <div class="po-item"><span class="po-key">营销学习</span>${esc(obs.marketing)}</div>
      <div class="po-item"><span class="po-key">创作者跟进</span>${esc(obs.creator)}</div>
    </div>`;
  html = replaceSection(html, '<!-- 平台观察 -->', '</section>', '\n' + obsHtml + '\n  ');

  // English Coach
  const eng = content.english;
  const engHtml = `    <div class="eng-section">
      <div class="eng-section-title">今日商务表达</div>
${(eng.expressions || []).map(renderVocabRow).join('\n')}
    </div>

    <!-- 今日面试问题 -->
    <div class="eng-section">
      <div class="eng-section-title">今日面试问题 — ${esc(eng.direction)}</div>
      <div class="interview-question">
        <div class="iq-en">${esc(eng.question.en)}</div>
        <div class="iq-cn">${esc(eng.question.zh)}</div>
        <div class="iq-analysis">
${(eng.analysis || []).map(a => `          <div class="iq-analysis-item"><span class="ia-key">${esc(a.key)}</span>${esc(a.val)}</div>`).join('\n')}
        </div>
      </div>
    </div>

    <!-- 三轮完整面试对话 -->
    <div class="eng-section">
      <div class="eng-section-title">三轮完整面试对话</div>

${(eng.rounds || []).map(renderDialogueRound).join('\n\n')}
    </div>

    <!-- 回答框架 -->
    <div class="eng-section">
      <div class="eng-section-title">本题回答框架</div>
      <div class="framework-box">
        <div class="framework-flow">
          ${esc(eng.framework)}
        </div>
      </div>
    </div>

    <!-- 可替换内容 -->
    <div class="eng-section">
      <div class="eng-section-title">可替换内容</div>
      <div class="framework-box">
        <ul class="replaceable-list">
${(eng.replaceable || []).map(r => `          <li>${esc(r)}</li>`).join('\n')}
        </ul>
      </div>
    </div>

    <!-- 面试官评价 -->
    <div class="eng-section">
      <div class="eng-section-title">面试官评价</div>
      <div class="evaluation-box">
${(eng.evaluation || []).map(renderEvalItem).join('\n')}
      </div>
    </div>

    `;

  // Replace English Coach content (from 今日商务表达 to 我的回答)
  html = replaceSection(html, '<!-- 今日商务表达 -->', '<!-- 我的回答 -->', '\n' + engHtml);

  writeFileSync('index.html', html);
  console.log('index.html updated successfully');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
