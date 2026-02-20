const QA_QUALITIES = ['专注', '共情', '气场', '欺瞒', '主动', '专业', '活力', '坚毅', '诡秘'];

const API_BASE = (window.location.port === '3001' ? '' : 'http://localhost:3001');

const AGENCY_TITLES = ['见习生', '专员', '高级专员', '助理总监', '总监', '地区总监', '副总裁', '高级副总裁', '执行副总裁', '主席'];

/** 机构限制：散逸端阈值 → { 起始混沌, 天气事件, 分部限制 } */
const AGENCY_LIMITS_TABLE = [
  { threshold: 11, 起始混沌: 5, 天气事件: 1, 分部限制: '在看似正常的对话中，特工们的人际关系会自发地提醒他们机构的职责以及减少散逸端的重要性。' },
  { threshold: 22, 起始混沌: 10, 天气事件: 2, 分部限制: '要获得三重升华的效果，特工必须发表一段简短的演说，重申他们致力于清除散逸端和稳定现实的决心。' },
  { threshold: 33, 起始混沌: 15, 天气事件: 3, 分部限制: '在进行任何掷骰前，特工都必须（大声或以等效方式）数到3。' },
  { threshold: 44, 起始混沌: 20, 天气事件: 4, 分部限制: '在散逸端数量降至44以下前，特工不再有资格获得MVP。' },
  { threshold: 55, 起始混沌: 25, 天气事件: 5, 分部限制: '向特工们宣读以下内容："若散逸端数量达到66，所有特工的合同都将被终止。如果你们无法通过任务减少此数量，就必须额外加班：从所有工作/生活平衡条的末尾划掉一个格子，以自行清除6个散逸端。"' },
  { threshold: 66, 起始混沌: '无', 天气事件: '无', 分部限制: '当前任务结束时，在役的外勤小队将被强制退休。他们必须从可用的退休选项中选择一个。如果没有，他们将被送往收容库。该管辖区的散逸端数量将减少11个，每有一名特工使用其职能提供的退休选项，便额外减少11个。' },
  { threshold: 77, 起始混沌: '无', 天气事件: '无', 分部限制: '崩解即将开始。为避免此事，该分部的管辖区将被从存在中抹除。' }
];

let statuses = null;
let arcReference = null;
let itemsCatalog = null;
let selectedAgentIndices = new Set();
const qaCurrentByAgent = {}; // session-only: agent index -> { quality: currentValue }

async function load() {
  try {
    const [statusesRes, arcRes, itemsRes] = await Promise.all([
      fetch(`${API_BASE}/api/statuses`),
      fetch(`${API_BASE}/api/arc-reference`),
      fetch(`${API_BASE}/api/items`)
    ]);
    if (!statusesRes.ok || !arcRes.ok) throw new Error('加载失败');
    statuses = await statusesRes.json();
    arcReference = await arcRes.json();
    try {
      itemsCatalog = itemsRes.ok ? (await itemsRes.json()) : { items: [] };
      if (!itemsCatalog || typeof itemsCatalog !== 'object') itemsCatalog = { items: [] };
      if (!Array.isArray(itemsCatalog.items)) itemsCatalog.items = [];
    } catch (_) {
      itemsCatalog = { items: [] };
    }
    Object.keys(qaCurrentByAgent).forEach(k => delete qaCurrentByAgent[k]);
    render();
  } catch (err) {
    showToast('加载失败: ' + err.message);
  }
}

function render() {
  renderAgency();
  renderAgencyLimits();
  renderNews();
  renderAgentSelect();
  renderAgentCards();
}

function renderAgency() {
  if (!statuses) return;
  const agency = statuses.agency || {};
  document.getElementById('chaosValue').value = agency.混沌值 ?? 0;
  document.getElementById('looseEnds').value = agency.散逸端 ?? 0;
}

function renderAgencyLimits() {
  const el = document.getElementById('agencyLimitsContent');
  if (!el) return;
  const looseEnds = parseInt(document.getElementById('looseEnds')?.value, 10) || 0;
  const rows = AGENCY_LIMITS_TABLE.filter(r => looseEnds >= r.threshold);
  const current = rows.length > 0 ? rows[rows.length - 1] : null;
  const 起始混沌 = current ? current.起始混沌 : '—';
  const 天气事件 = current ? current.天气事件 : '—';
  const restrictions = rows.map(r => r.分部限制);
  el.innerHTML = `
    <div class="agency-limits-row"><span class="agency-limits-label">起始混沌</span><span class="agency-limits-value">${escapeHtml(String(起始混沌))}</span></div>
    <div class="agency-limits-row"><span class="agency-limits-label">天气事件</span><span class="agency-limits-value">${escapeHtml(String(天气事件))}</span></div>
    <div class="agency-limits-restrictions">
      <span class="agency-limits-label">分部限制（可累计）</span>
      ${restrictions.length === 0 ? '<p class="agency-limits-empty">当前散逸端未达任一阈值，无限制。</p>' : restrictions.map(t => `<p class="agency-limits-item">${escapeHtml(t)}</p>`).join('')}
    </div>
  `;
}

function renderNews() {
  if (!statuses) return;
  const news = statuses.agency?.news || [];
  const list = document.getElementById('newsList');
  list.innerHTML = news.map((item, i) => `
    <li class="news-item" data-index="${i}">
      <span>
        <span class="news-item-date">${escapeHtml(item.date || '')}</span>
        <span>${escapeHtml(item.text || '')}</span>
      </span>
      <button class="news-item-remove" data-index="${i}">删除</button>
    </li>
  `).join('');
  list.querySelectorAll('.news-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeNews(parseInt(btn.dataset.index)));
  });
}

function renderAgentSelect() {
  if (!statuses) return;
  const agents = statuses.agents || [];
  const panel = document.getElementById('agentDropdownPanel');
  const trigger = document.getElementById('agentDropdownTrigger');
  const countEl = document.getElementById('agentCount');

  panel.innerHTML = `<div class="agent-checkboxes">${agents.map((a, i) => `
    <label class="agent-checkbox">
      <input type="checkbox" data-index="${i}" ${selectedAgentIndices.has(i) ? 'checked' : ''} />
      <span>${escapeHtml(a.name || '未命名')}${a.aka ? ` (${escapeHtml(a.aka)})` : ''}</span>
    </label>
  `).join('')}</div>`;

  panel.querySelectorAll('.agent-checkbox input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const i = parseInt(cb.dataset.index);
      if (cb.checked) selectedAgentIndices.add(i);
      else selectedAgentIndices.delete(i);
      updateAgentCount();
      renderAgentCards();
    });
  });

  trigger.onclick = (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  };

  if (!trigger._dropdownBound) {
    trigger._dropdownBound = true;
    document.addEventListener('click', (e) => {
      const wrap = document.querySelector('.agent-dropdown-wrap');
      if (wrap && !wrap.contains(e.target)) {
        panel.classList.remove('open');
      }
    });
  }

  function updateAgentCount() {
    const n = selectedAgentIndices.size;
    countEl.textContent = n > 0 ? `(${n})` : '(0)';
  }
  updateAgentCount();
}

function saveQaCurrentToStore() {
  document.querySelectorAll('.agent-card').forEach(card => {
    const index = parseInt(card.dataset.agentIndex);
    if (isNaN(index)) return;
    if (!qaCurrentByAgent[index]) qaCurrentByAgent[index] = {};
    QA_QUALITIES.forEach(q => {
      const maxInput = card.querySelector(`input[data-qa="${q}"][data-type="max"]`);
      const currentInput = card.querySelector(`input[data-qa="${q}"][data-type="current"]`);
      if (maxInput && currentInput) {
        const max = parseInt(maxInput.value) || 0;
        const val = parseInt(currentInput.value) || 0;
        qaCurrentByAgent[index][q] = Math.min(Math.max(0, val), max);
      }
    });
  });
}

function renderAgentCards() {
  if (!statuses?.agents) return;
  const container = document.getElementById('agentCards');
  const indices = [...selectedAgentIndices].sort((a, b) => a - b);
  if (indices.length === 0) {
    container.innerHTML = '<p class="no-cards-hint">点击「选择特工」下拉框，勾选特工以显示编辑卡片</p>';
    return;
  }
  saveQaCurrentToStore();
  container.innerHTML = indices.map(i => buildAgentCard(i)).filter(Boolean).join('');
  indices.forEach(i => attachCardListeners(i));
  container.querySelectorAll('.agent-card-flip').forEach(flipWrap => {
    const card = flipWrap.closest('.agent-card');
    const idx = card ? parseInt(card.dataset.agentIndex, 10) : NaN;
    if (!isNaN(idx) && flippedCardIndices.has(idx)) flipWrap.classList.add('flipped');
  });
}

function buildAgentCard(index) {
  const agent = statuses?.agents?.[index];
  if (!agent) return '';
  const qa = agent.qa || {};
  if (!qaCurrentByAgent[index]) qaCurrentByAgent[index] = {};
  QA_QUALITIES.forEach(q => {
    const max = qa[q] ?? 0;
    if (qaCurrentByAgent[index][q] === undefined) qaCurrentByAgent[index][q] = max;
  });
  const qaHtml = QA_QUALITIES.map(q => {
    const max = qa[q] ?? 0;
    const current = Math.min(qaCurrentByAgent[index]?.[q] ?? max, max);
    return `
    <div class="qa-field">
      <label>${q}</label>
      <input type="number" data-agent="${index}" data-qa="${q}" data-type="max" min="0" value="${max}" placeholder="—" title="最大" />
      <input type="number" data-agent="${index}" data-qa="${q}" data-type="current" min="0" max="${max}" value="${current}" title="剩余" />
    </div>
  `;
  }).join('');

  const anomalyHtml = buildRefAnomalyHtml(agent, index);
  const realityHtml = buildRefRealityHtml(agent, index);
  const competencyHtml = buildRefCompetencyHtml(agent);
  const itemsHtml = buildRefItemsHtml(agent, index);
  const backHtml = buildArcTrackersHtml(agent, index);

  return `
    <div class="agent-card" data-agent-index="${index}">
      <div class="agent-card-flip">
        <div class="agent-card-front">
          <button type="button" class="agent-track-btn" aria-label="翻转查看轨道">轨道</button>
          <div class="agent-card-header">${escapeHtml(agent.name || '未命名')}${agent.aka ? ` — ${escapeHtml(agent.aka)}` : ''}</div>
          <div class="edit-scores">
        <div class="score-field 机构头衔">
          <label>机构头衔</label>
          <select data-agent="${index}" data-field="机构头衔">
            <option value="">—</option>
            ${AGENCY_TITLES.map(t => `<option value="${escapeHtml(t)}" ${(agent.机构头衔 || '') === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
          </select>
        </div>
        <div class="score-field 嘉奖"><span class="score-icon">★</span><label>嘉奖</label><input type="number" data-agent="${index}" data-score="嘉奖" min="0" value="${agent.嘉奖 ?? 0}" /></div>
        <div class="score-field 申诫"><span class="score-icon">✗</span><label>申诫</label><input type="number" data-agent="${index}" data-score="申诫" min="0" value="${agent.申诫 ?? 0}" /></div>
        <div class="score-field 察看期"><span class="score-icon">▣</span><label>察看期</label><input type="number" data-agent="${index}" data-score="察看期" min="0" value="${agent.察看期 ?? 0}" /></div>
        <div class="score-field mvp"><span class="score-icon">◆</span><label>mvp</label><input type="number" data-agent="${index}" data-score="mvp" min="0" value="${agent.mvp ?? 0}" /></div>
        <div class="score-field flag-socks">
          <label class="checkbox-label"><input type="checkbox" data-agent="${index}" data-field="flag" ${agent.flag ? 'checked' : ''} /> 🚩</label>
          <label class="checkbox-label"><input type="checkbox" data-agent="${index}" data-field="socks" ${agent.socks ? 'checked' : ''} /> 🧦</label>
        </div>
      </div>
      <div class="qa-editor">
        <h4>资质保证 (QA) — 最大 / 剩余</h4>
        <div class="qa-grid">${qaHtml}</div>
      </div>
      <div class="reference-section">
        <div class="ref-block 异常">
          <div class="ref-block-header-row">
            <div class="ref-block-title">异常 — ${escapeHtml(agent.arc?.异常?.choice || '—')}</div>
            <button type="button" class="anomaly-abilities-add-btn" data-agent="${index}">添加</button>
          </div>
          <div class="anomaly-abilities-list">${anomalyHtml}</div>
        </div>
        <div class="ref-block 现实">
          <div class="ref-block-header-row">
            <div class="ref-block-title">现实 — ${escapeHtml(agent.arc?.现实?.choice || '—')}</div>
            <button class="switch-reality-btn" type="button" data-agent="${index}">切换现实</button>
          </div>
          ${realityHtml}
        </div>
        <div class="ref-block 职能">
          <div class="ref-block-title">职能 — ${escapeHtml(agent.arc?.职能?.choice || '—')}</div>
          ${competencyHtml}
        </div>
        <div class="ref-block 申领物">
          <div class="ref-block-header-row">
            <div class="ref-block-title">申领物</div>
            <button class="items-add-btn" type="button" data-agent="${index}">添加</button>
          </div>
          <div class="items-list" data-agent="${index}">${itemsHtml}</div>
        </div>
      </div>
        </div>
        <div class="agent-card-back">${backHtml}</div>
      </div>
    </div>
  `;
}

const TRACK_NAMES = ['职能', '现实', '异常'];
const NUM_TRACK_BOXES = 30;
/** Playwall refs: key = 0-based box index (user list was 1-based: position 1 = index 0). */
const WALL_TRACK_REFS = {
  职能: { 2: 'A3', 5: 'D4', 8: 'G3', 11: 'J3', 14: 'N3', 17: 'Q3', 20: 'T3', 23: 'W8', 26: 'Y2' },
  现实: { 0: 'C4', 3: 'L11', 7: 'E2', 9: 'O4', 13: 'T6', 16: 'V2', 18: 'X3', 20: 'H5', 23: 'E3' },
  异常: { 0: 'H4', 1: 'H3', 4: 'U2', 6: 'X2', 10: 'N1', 12: 'Q2', 16: 'L10', 18: 'G8', 22: 'A7' }
};
let flippedCardIndices = new Set();

const ARC_TRACKS_HELP_GENERAL = '每当你标记一格时，你必须从所有其他记录条的末尾划掉一格。';
const ARC_TRACK_HELP = {
  职能: '每当你在职能记录条上标记一格时，将任意一项资质的「资质保证上限」提升1点，最高不超过9点。<br>当你获得任务MVP时，在你的职能记录条上标记1格，且无需从其他记录条上移除一格。',
  现实: '每当你在现实记录条上标记一格时，将你与任意一段「关系」的「连结」提升1点。<br>当你既未获得任务MVP也未进入察看期时，你可以将你与任意一段关系的连结提升1点。',
  异常: '每当你在异常记录条上标记一格时，选择一项：练习或为人所知。<br>• 练习：在任意一项异常能力上标记「已练习」。<br>• 为人所知：从一项异常能力中移除「已练习」标记，并向你的团队提出该能力的问题。在获得最多票数的答案轨道上做标记，然后获得所有已解锁的能力。<br>当你进入察看期时，在你的异常记录条上标记1格，且无需从其他记录条上移除一格。'
};

function buildArcTrackersHtml(agent, agentIndex) {
  const wallTracks = agent.wallTracks || {
    职能: { marked: 0, struck: 0 },
    现实: { marked: 0, struck: 0 },
    异常: { marked: 0, struck: 0 }
  };
  function boxState(name, i) {
    const track = wallTracks[name] || { marked: 0, struck: 0 };
    const marked = Math.max(0, parseInt(track.marked, 10) || 0);
    const struck = Math.max(0, parseInt(track.struck, 10) || 0);
    const filled = i < marked;
    const struckFromEnd = i >= NUM_TRACK_BOXES - struck;
    return { filled, struck: struckFromEnd };
  }
  function oneBox(name, i) {
    const refs = WALL_TRACK_REFS[name] || {};
    const ref = refs[i];
    const { filled, struck } = boxState(name, i);
    const cls = ['tracker-step', filled ? 'filled' : '', struck ? 'struck' : '', ref ? 'ref' : ''].filter(Boolean).join(' ');
    const inner = ref ? escapeHtml(ref) : '';
    return `<div class="${cls}" data-idx="${i}"><span class="tracker-step-inner">${inner}</span></div>`;
  }
  function bar(name) {
    const track = wallTracks[name] || { marked: 0, struck: 0 };
    const markedVal = Math.max(0, Math.min(NUM_TRACK_BOXES, parseInt(track.marked, 10) || 0));
    const struckVal = Math.max(0, Math.min(NUM_TRACK_BOXES, parseInt(track.struck, 10) || 0));
    let cells = '';
    for (let i = 0; i < NUM_TRACK_BOXES; i++) {
      const conn = i < NUM_TRACK_BOXES - 1 ? '<div class="arc-track-connector h" aria-hidden="true"></div>' : '';
      cells += `<div class="arc-track-cell">${oneBox(name, i)}${conn}</div>`;
    }
    const gmControls = `
      <div class="arc-track-gm-controls" data-track="${escapeHtml(name)}">
        <span class="arc-track-gm-label">标记</span>
        <button type="button" class="arc-track-gm-btn" data-field="marked" data-delta="-1" aria-label="减少标记">−</button>
        <span class="arc-track-gm-value marked">${markedVal}</span>
        <button type="button" class="arc-track-gm-btn" data-field="marked" data-delta="1" aria-label="增加标记">+</button>
        <span class="arc-track-gm-label">划除</span>
        <button type="button" class="arc-track-gm-btn" data-field="struck" data-delta="-1" aria-label="减少划除">−</button>
        <span class="arc-track-gm-value struck">${struckVal}</span>
        <button type="button" class="arc-track-gm-btn" data-field="struck" data-delta="1" aria-label="增加划除">+</button>
      </div>`;
    return `
      <div class="arc-track ${name}">
        <div class="arc-track-name">${name}</div>
        <div class="arc-track-help">${ARC_TRACK_HELP[name] || ''}</div>
        ${gmControls}
        <div class="arc-track-bar">${cells}</div>
      </div>`;
  }
  return `
    <div class="agent-card-back-tracks">
      <div class="agent-card-back-title">轨道</div>
      <button type="button" class="agent-track-btn agent-track-btn-back">特工</button>
      <p class="arc-tracks-help">${ARC_TRACKS_HELP_GENERAL}</p>
      ${TRACK_NAMES.map(bar).join('')}
    </div>`;
}

function buildWellKnownBoxesEditor(wellKnown, agentIndex, abilityIndex, key) {
  const val = Math.min(3, Math.max(0, parseInt(wellKnown?.[key], 10) || 0));
  let html = '';
  for (let i = 0; i < 3; i++) {
    const checked = i < val;
    html += `<label class="well-known-box-label" onmousedown="event.stopPropagation()">
      <input type="checkbox" data-anomaly-wellknown data-agent="${agentIndex}" data-ability-index="${abilityIndex}" data-well-known="${key}" data-box-index="${i}" ${checked ? 'checked' : ''} />
      <span class="well-known-box ${checked ? 'filled' : ''}"></span>
    </label>`;
  }
  return html;
}

function buildRefAnomalyHtml(agent, agentIndex) {
  const choice = agent.arc?.异常?.choice;
  const ref = arcReference?.异常?.find(a => a.id === choice);
  const refAbilities = ref?.abilities || [];
  const agentAbilities = agent.arc?.异常?.abilities || [];
  const abilities = agentAbilities.length
    ? agentAbilities
    : refAbilities.map(ab => ({ ...ab, 已练习: false, wellKnown: { a: 0, b: 0 } }));
  if (abilities.length === 0) return '<div class="ref-item-desc">无（点击「添加」新增）</div>';
  return abilities.map((ab, i) => {
    const practicable = ab.wellKnown != null || ab.已练习 !== undefined;
    const wk = ab.wellKnown || { a: 0, b: 0 };
    const wellKnownHtml = practicable ? `
      <div class="well-known-track">
        <span class="well-known-intro">为人所知</span>
        <span class="well-known-label">A</span>
        <div class="well-known-boxes">${buildWellKnownBoxesEditor(wk, agentIndex, i, 'a')}</div>
        <span class="well-known-label">B</span>
        <div class="well-known-boxes">${buildWellKnownBoxesEditor(wk, agentIndex, i, 'b')}</div>
      </div>` : '';
    const actionsHtml = practicable
      ? `<button type="button" class="ability-change-btn" data-agent="${agentIndex}" data-ability-index="${i}" onmousedown="event.stopPropagation()">变化</button>
            <label class="ability-proficient-label" onmousedown="event.stopPropagation()">
              <input type="checkbox" data-anomaly-proficient data-agent="${agentIndex}" data-ability-index="${i}" ${ab.已练习 ? 'checked' : ''} />
              已练习
            </label>`
      : '';
    return `
    <details class="ref-item" data-agent="${agentIndex}" data-ability-index="${i}">
      <summary>
        <span class="ability-summary-inner">
          <span class="ability-name">${escapeHtml(ab.name || '')}</span>
          <span class="ability-actions" onmousedown="event.stopPropagation()">
            ${actionsHtml}
            <button type="button" class="ability-remove-btn" data-agent="${agentIndex}" data-ability-index="${i}">删除</button>
          </span>
        </span>
      </summary>
      <div class="ref-item-desc">${formatDescriptionWithOutcomes(ab.description || '')}</div>
      ${wellKnownHtml ? `<div class="ref-item-desc well-known-wrap">${wellKnownHtml}</div>` : ''}
    </details>
  `;
  }).join('');
}

function buildRefRealityHtml(agent, agentIndex) {
  const choice = agent.arc?.现实?.choice;
  const ref = arcReference?.现实?.find(r => r.id === choice);
  if (!ref) return '<div class="ref-item-desc">无</div>';
  const 割裂进度 = Math.min(4, Math.max(0, parseInt(agent.arc?.现实?.割裂进度, 10) || 0));
  let html = `<div class="reality-split-editor" data-agent="${agentIndex}">
    <span class="reality-split-label">割裂进度：</span>
    <div class="reality-split-tracker-editor">
      <div class="tracker-start"></div>
      <div class="tracker-connector"></div>
      ${[1, 2, 3, 4].map(i => `
        <button type="button" class="tracker-step-btn ${i <= 割裂进度 ? 'filled' : ''} ${i === 3 && i <= 割裂进度 ? 'warning' : ''}" data-agent="${agentIndex}" data-value="${i}" title="点击设为 ${i}">${i}</button>
        ${i < 4 ? '<div class="tracker-connector"></div>' : ''}
      `).join('')}
      <div class="tracker-connector"></div>
      <div class="tracker-end ${割裂进度 >= 4 ? 'failed' : ''}">✕</div>
    </div>
    <input type="number" data-agent="${agentIndex}" data-reality-split min="0" max="4" value="${割裂进度}" class="reality-split-input" title="0-4" />
  </div>`;
  if (ref.现实触发器) {
    html += `<details class="ref-item">
      <summary>${escapeHtml(ref.现实触发器.name || '')}</summary>
      <div class="ref-item-desc">${formatDescriptionWithOutcomes(ref.现实触发器.description || '')}</div>
    </details>`;
  }
  if (ref.过载解除) {
    html += `<details class="ref-item">
      <summary>${escapeHtml(ref.过载解除.name || '')}</summary>
      <div class="ref-item-desc">${formatDescriptionWithOutcomes(ref.过载解除.description || '')}</div>
    </details>`;
  }
  html += buildRelationshipsEditorHtml(agent, agentIndex);
  return html || '<div class="ref-item-desc">无</div>';
}

function buildRelationshipsEditorHtml(agent, agentIndex) {
  const 关系 = agent.arc?.现实?.关系 || [];
  const itemsHtml = 关系.length === 0
    ? '<div class="ref-item-desc">无（点击「添加」新增）</div>'
    : 关系.map((rel, i) => `
      <details class="ref-item relationship-editor-item" data-agent="${agentIndex}" data-rel-index="${i}">
        <summary>
          <span class="relationship-editor-summary">
            <span class="rel-name">${escapeHtml(rel.name || '')}</span>
            <span class="rel-meta">连结${Math.min(9, Math.max(1, rel.closeness || 0))} · ${escapeHtml(rel.benefit || '—')} · ${rel.benefitActive ? '已激活' : '未激活'}</span>
            <span class="rel-actions" onmousedown="event.stopPropagation()">
              <button type="button" class="rel-edit-btn" data-agent="${agentIndex}" data-rel-index="${i}">编辑</button>
              <button type="button" class="rel-remove-btn" data-agent="${agentIndex}" data-rel-index="${i}">删除</button>
            </span>
          </span>
        </summary>
        <div class="ref-item-desc">${escapeHtml(rel.description || '')}${rel.benefit ? `<div class="rel-benefit-block"><strong>连结加成：</strong>${escapeHtml(rel.benefit)}${rel.benefitDescription ? ` — ${escapeHtml(rel.benefitDescription)}` : ''}</div>` : ''}</div>
      </details>
    `).join('');
  return `
    <div class="ref-block-relationships">
      <div class="ref-block-header-row">
        <div class="ref-block-title">关系</div>
        <button type="button" class="relationships-add-btn" data-agent="${agentIndex}">添加</button>
      </div>
      <div class="relationships-editor-list">${itemsHtml}</div>
    </div>`;
}

function buildRefCompetencyHtml(agent) {
  const choice = agent.arc?.职能?.choice;
  const ref = arcReference?.职能?.find(c => c.id === choice);
  if (!ref) return '<div class="ref-item-desc">无</div>';
  let html = '';
  if (ref.首要指令) {
    html += `<details class="ref-item" open>
      <summary>${escapeHtml(ref.首要指令.name || '')}</summary>
      <div class="ref-item-desc">${formatDescriptionWithOutcomes(ref.首要指令.description || '')}</div>
    </details>`;
  }
  if (ref.许可行为 && ref.许可行为.length) {
    html += `<details class="ref-item" open>
      <summary>许可行为</summary>
      <div class="ref-item-desc">${ref.许可行为.map(p => '• ' + escapeHtml(String(p))).join('\n')}</div>
    </details>`;
  }
  return html || '<div class="ref-item-desc">无</div>';
}

function buildRefItemsHtml(agent, agentIndex) {
  const items = agent.申领物 || [];
  if (items.length === 0) {
    return '<div class="ref-item-desc">无（点击「添加」新增）</div>';
  }
  return items.map((item, i) => {
    const isInitial = i === 0;
    return `
    <details class="ref-item 申领物-item" data-agent="${agentIndex}" data-item-index="${i}">
      <summary>
        <span class="item-summary-inner">
          <span class="item-name">${escapeHtml(item.name || '')}</span>
          ${!isInitial ? `<button class="item-remove-btn" data-agent="${agentIndex}" data-item-index="${i}" type="button" onmousedown="event.stopPropagation()">删除</button>` : ''}
        </span>
      </summary>
      <div class="ref-item-desc">${escapeHtml(item.description || '')}</div>
    </details>
  `;
  }).join('');
}

function attachCardListeners(index) {
  // Inputs are already in the DOM, no need to attach - we collect on save
}

let itemsModalAgentIndex = null;
let switchRealityAgentIndex = null;
let changeAbilityAgentIndex = null;
let changeAbilityIndex = null;
let relationshipModalAgentIndex = null;
let relationshipModalRelIndex = null;
let addAbilityModalAgentIndex = null;

function openChangeAbilityModal(agentIndex, abilityIndex) {
  changeAbilityAgentIndex = agentIndex;
  changeAbilityIndex = abilityIndex;
  const agent = statuses?.agents?.[agentIndex];
  if (!agent) return;
  agent.arc = agent.arc || {};
  agent.arc.异常 = agent.arc.异常 || {};
  let abilities = agent.arc.异常.abilities || [];
  if (abilities.length === 0) {
    const ref = arcReference?.异常?.find(a => a.id === agent.arc?.异常?.choice);
    const refAbilities = ref?.abilities || [];
    if (refAbilities.length > 0) {
      agent.arc.异常.abilities = refAbilities.map(ab => ({ ...ab, 已练习: false, wellKnown: { a: 0, b: 0 } }));
      abilities = agent.arc.异常.abilities;
    }
  }
  const ab = abilities[abilityIndex] || {};
  document.getElementById('changeAbilityName').value = ab.name || '';
  document.getElementById('changeAbilityDesc').value = ab.description || '';
  document.getElementById('changeAbilityModalOverlay').classList.add('open');
  document.getElementById('changeAbilityName').focus();
}

function closeChangeAbilityModal() {
  document.getElementById('changeAbilityModalOverlay').classList.remove('open');
  changeAbilityAgentIndex = null;
  changeAbilityIndex = null;
}

function openAddAbilityModal(agentIndex) {
  addAbilityModalAgentIndex = agentIndex;
  document.getElementById('addAbilityModalTitle').textContent = '添加异常能力';
  document.getElementById('addAbilityName').value = '';
  document.getElementById('addAbilityDesc').value = '';
  document.getElementById('addAbilityPracticable').checked = false;
  document.getElementById('addAbilityModalOverlay').classList.add('open');
  document.getElementById('addAbilityName').focus();
}

function closeAddAbilityModal() {
  document.getElementById('addAbilityModalOverlay').classList.remove('open');
  addAbilityModalAgentIndex = null;
}

function submitAddAbility() {
  const name = document.getElementById('addAbilityName').value.trim();
  if (!name) {
    showToast('请输入能力名称');
    return;
  }
  if (addAbilityModalAgentIndex == null || !statuses?.agents?.[addAbilityModalAgentIndex]) return;
  const agent = statuses.agents[addAbilityModalAgentIndex];
  agent.arc = agent.arc || {};
  agent.arc.异常 = agent.arc.异常 || {};
  let abilities = agent.arc.异常.abilities;
  if (!abilities || abilities.length === 0) {
    const ref = arcReference?.异常?.find(a => a.id === agent.arc?.异常?.choice);
    const refAbilities = ref?.abilities || [];
    agent.arc.异常.abilities = refAbilities.map(ab => ({ ...ab, 已练习: false, wellKnown: { a: 0, b: 0 } }));
    abilities = agent.arc.异常.abilities;
  }
  const description = document.getElementById('addAbilityDesc').value.trim();
  const practicable = document.getElementById('addAbilityPracticable').checked;
  const newAb = { name, description };
  if (practicable) {
    newAb.已练习 = false;
    newAb.wellKnown = { a: 0, b: 0 };
  }
  abilities.push(newAb);
  closeAddAbilityModal();
  renderAgentCards();
  showToast('已添加异常能力');
}

function openRelationshipModal(agentIndex, relIndex) {
  const agent = statuses?.agents?.[agentIndex];
  if (!agent) return;
  relationshipModalAgentIndex = agentIndex;
  relationshipModalRelIndex = relIndex;
  agent.arc = agent.arc || {};
  agent.arc.现实 = agent.arc.现实 || {};
  agent.arc.现实.关系 = agent.arc.现实.关系 || [];
  const rel = relIndex != null ? agent.arc.现实.关系[relIndex] : null;
  document.getElementById('relationshipModalTitle').textContent = relIndex != null ? '编辑关系' : '添加关系';
  document.getElementById('relName').value = rel?.name || '';
  document.getElementById('relActor').value = rel?.actor || '';
  document.getElementById('relDesc').value = rel?.description || '';
  document.getElementById('relBenefit').value = rel?.benefit || '';
  document.getElementById('relBenefitDesc').value = rel?.benefitDescription || '';
  document.getElementById('relCloseness').value = rel ? Math.min(9, Math.max(1, rel.closeness || 1)) : 1;
  document.getElementById('relBenefitActive').checked = rel?.benefitActive || false;
  document.getElementById('relationshipModalOverlay').classList.add('open');
  document.getElementById('relName').focus();
}

function closeRelationshipModal() {
  document.getElementById('relationshipModalOverlay').classList.remove('open');
  relationshipModalAgentIndex = null;
  relationshipModalRelIndex = null;
}

function submitRelationship() {
  const name = document.getElementById('relName').value.trim();
  if (!name) {
    showToast('请输入关系人名称');
    return;
  }
  if (relationshipModalAgentIndex == null || !statuses?.agents?.[relationshipModalAgentIndex]) return;
  const agent = statuses.agents[relationshipModalAgentIndex];
  agent.arc = agent.arc || {};
  agent.arc.现实 = agent.arc.现实 || {};
  agent.arc.现实.关系 = agent.arc.现实.关系 || [];
  const closeness = Math.min(9, Math.max(1, parseInt(document.getElementById('relCloseness').value, 10) || 1));
  const rel = {
    name,
    actor: document.getElementById('relActor').value.trim(),
    description: document.getElementById('relDesc').value.trim(),
    benefit: document.getElementById('relBenefit').value.trim(),
    benefitDescription: document.getElementById('relBenefitDesc').value.trim(),
    benefitActive: document.getElementById('relBenefitActive').checked,
    closeness
  };
  if (relationshipModalRelIndex != null) {
    agent.arc.现实.关系[relationshipModalRelIndex] = rel;
    showToast('已更新关系');
  } else {
    agent.arc.现实.关系.push(rel);
    showToast('已添加关系');
  }
  closeRelationshipModal();
  renderAgentCards();
}

function submitChangeAbility() {
  const name = document.getElementById('changeAbilityName').value.trim();
  const description = document.getElementById('changeAbilityDesc').value.trim();
  if (!name) {
    showToast('请输入能力名称');
    return;
  }
  if (changeAbilityAgentIndex == null || changeAbilityIndex == null || !statuses?.agents?.[changeAbilityAgentIndex]) return;
  const agent = statuses.agents[changeAbilityAgentIndex];
  agent.arc = agent.arc || {};
  agent.arc.异常 = agent.arc.异常 || {};
  agent.arc.异常.abilities = agent.arc.异常.abilities || [];
  if (changeAbilityIndex >= agent.arc.异常.abilities.length) return;
  const existing = agent.arc.异常.abilities[changeAbilityIndex] || {};
  agent.arc.异常.abilities[changeAbilityIndex] = {
    name,
    description,
    已练习: existing.已练习 || false,
    wellKnown: existing.wellKnown || { a: 0, b: 0 }
  };
  closeChangeAbilityModal();
  renderAgentCards();
  showToast('已更换能力');
}

function openSwitchRealityModal(agentIndex) {
  switchRealityAgentIndex = agentIndex;
  const listEl = document.getElementById('switchRealityList');
  const realities = arcReference?.现实 || [];
  if (realities.length === 0) {
    listEl.innerHTML = '<div class="modal-empty">暂无可用现实</div>';
  } else {
    listEl.innerHTML = realities.map((r, idx) => `
      <button type="button" class="switch-reality-option" data-reality-index="${idx}">
        ${escapeHtml(r.id || '')}
      </button>
    `).join('');
    listEl.querySelectorAll('.switch-reality-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.realityIndex);
        const ref = arcReference?.现实?.[idx];
        const realityId = ref?.id;
        if (!ref || switchRealityAgentIndex == null || !statuses?.agents?.[switchRealityAgentIndex]) return;
        const agent = statuses.agents[switchRealityAgentIndex];
        agent.arc = agent.arc || {};
        const existingRelations = agent.arc?.现实?.关系 || [];
        const existingSplitProgress = agent.arc?.现实?.割裂进度 ?? 0;
        agent.arc.现实 = {
          choice: realityId,
          割裂进度: existingSplitProgress,
          关系: [...existingRelations],
          ...(ref.现实触发器 && { 现实触发器: { ...ref.现实触发器 } }),
          ...(ref.过载解除 && { 过载解除: { ...ref.过载解除 } })
        };
        closeSwitchRealityModal();
        renderAgentCards();
        showToast('已切换现实：' + realityId);
      });
    });
  }
  document.getElementById('switchRealityModalOverlay').classList.add('open');
}

function closeSwitchRealityModal() {
  document.getElementById('switchRealityModalOverlay').classList.remove('open');
  switchRealityAgentIndex = null;
}

function openItemsModal(agentIndex) {
  itemsModalAgentIndex = agentIndex;
  document.getElementById('itemsModalSearch').value = '';
  renderItemsModalList('');
  document.getElementById('itemsModalOverlay').classList.add('open');
  document.getElementById('itemsModalSearch').focus();
}

function closeItemsModal() {
  document.getElementById('itemsModalOverlay').classList.remove('open');
  itemsModalAgentIndex = null;
}

function renderItemsModalList(searchTerm) {
  const listEl = document.getElementById('itemsModalList');
  const items = itemsCatalog?.items || [];
  const term = (searchTerm || '').trim().toLowerCase();
  const filtered = term
    ? items.filter(i => (i.name || '').toLowerCase().includes(term))
    : items;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="modal-empty">' + (term ? '无匹配结果' : '暂无可用申领物') + '</div>';
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const priceSuffix = item.price != null ? ` - ${item.price}嘉奖` : '';
    return `
    <div class="modal-item" data-item-id="${escapeHtml(item.id || '')}">
      <div class="modal-item-header">
        <span class="modal-item-name">${escapeHtml(item.name || '')}${priceSuffix}</span>
      </div>
      <div class="modal-item-desc">${escapeHtml(item.description || '')}</div>
      <button class="modal-item-add" type="button" data-item-id="${escapeHtml(item.id || '')}">添加</button>
    </div>
  `;
  }).join('');

  listEl.querySelectorAll('.modal-item-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const catalogItem = itemsCatalog?.items?.find(i => (i.id || i.name) === itemId);
      if (catalogItem && itemsModalAgentIndex != null && statuses?.agents?.[itemsModalAgentIndex]) {
        statuses.agents[itemsModalAgentIndex].申领物 = statuses.agents[itemsModalAgentIndex].申领物 || [];
        statuses.agents[itemsModalAgentIndex].申领物.push({
          name: catalogItem.name || '',
          description: catalogItem.description || '',
          price: catalogItem.price
        });
        closeItemsModal();
        renderAgentCards();
      }
    });
  });
}

function setupItemsDelegation() {
  document.addEventListener('change', (e) => {
    const wellKnownInput = e.target.closest('input[data-anomaly-wellknown]');
    if (wellKnownInput) {
      const card = wellKnownInput.closest('.agent-card');
      if (!card) return;
      const agentIndex = wellKnownInput.dataset.agent;
      const abilityIndex = wellKnownInput.dataset.abilityIndex;
      const key = wellKnownInput.dataset.wellKnown;
      const boxIndex = parseInt(wellKnownInput.dataset.boxIndex, 10);
      const inputs = [...card.querySelectorAll(`input[data-anomaly-wellknown][data-ability-index="${abilityIndex}"][data-well-known="${key}"]`)];
      inputs.sort((a, b) => parseInt(a.dataset.boxIndex, 10) - parseInt(b.dataset.boxIndex, 10));
      if (wellKnownInput.checked) {
        inputs.forEach((inp, i) => { if (i <= boxIndex) inp.checked = true; });
      } else {
        inputs.forEach((inp, i) => { if (i >= boxIndex) inp.checked = false; });
      }
      return;
    }
  });

  document.addEventListener('click', (e) => {
    const trackBtn = e.target.closest('.agent-track-btn');
    if (trackBtn) {
      e.preventDefault();
      const card = trackBtn.closest('.agent-card');
      const flipWrap = card?.querySelector('.agent-card-flip');
      const idx = card ? parseInt(card.dataset.agentIndex, 10) : NaN;
      if (!flipWrap || isNaN(idx)) return;
      if (trackBtn.classList.contains('agent-track-btn-back')) {
        flipWrap.classList.remove('flipped');
        flippedCardIndices.delete(idx);
      } else {
        flipWrap.classList.add('flipped');
        flippedCardIndices.add(idx);
      }
      return;
    }
    const gmBtn = e.target.closest('.arc-track-gm-btn');
    if (gmBtn) {
      e.preventDefault();
      const card = gmBtn.closest('.agent-card');
      const idx = card ? parseInt(card.dataset.agentIndex, 10) : NaN;
      if (isNaN(idx) || !statuses?.agents?.[idx]) return;
      const trackEl = gmBtn.closest('.arc-track');
      const trackName = trackEl?.classList.contains('职能') ? '职能' : trackEl?.classList.contains('现实') ? '现实' : trackEl?.classList.contains('异常') ? '异常' : null;
      if (!trackName) return;
      const field = gmBtn.dataset.field;
      const delta = parseInt(gmBtn.dataset.delta, 10) || 0;
      if (field !== 'marked' && field !== 'struck') return;
      const agent = statuses.agents[idx];
      if (!agent.wallTracks) agent.wallTracks = { 职能: { marked: 0, struck: 0 }, 现实: { marked: 0, struck: 0 }, 异常: { marked: 0, struck: 0 } };
      if (!agent.wallTracks[trackName]) agent.wallTracks[trackName] = { marked: 0, struck: 0 };
      const current = Math.max(0, parseInt(agent.wallTracks[trackName][field], 10) || 0);
      agent.wallTracks[trackName][field] = Math.max(0, Math.min(NUM_TRACK_BOXES, current + delta));
      renderAgentCards();
      return;
    }
    const stepBtn = e.target.closest('.tracker-step-btn');
    if (stepBtn) {
      e.preventDefault();
      const agentIndex = parseInt(stepBtn.dataset.agent);
      const value = parseInt(stepBtn.dataset.value);
      if (!isNaN(agentIndex) && !isNaN(value)) {
        const editor = stepBtn.closest('.reality-split-editor');
        const input = editor?.querySelector('input[data-reality-split]');
        if (input) {
          input.value = value;
          stepBtn.parentElement.querySelectorAll('.tracker-step-btn').forEach((btn, i) => {
            btn.classList.toggle('filled', parseInt(btn.dataset.value) <= value);
            btn.classList.toggle('warning', parseInt(btn.dataset.value) === 3 && parseInt(btn.dataset.value) <= value);
          });
          const endEl = editor?.querySelector('.tracker-end');
          if (endEl) {
            endEl.classList.toggle('failed', value >= 4);
            endEl.textContent = '✕';
          }
        }
      }
      return;
    }
    const switchRealityBtn = e.target.closest('.switch-reality-btn');
    if (switchRealityBtn) {
      e.preventDefault();
      const agentIndex = parseInt(switchRealityBtn.dataset.agent);
      if (!isNaN(agentIndex)) {
        openSwitchRealityModal(agentIndex);
      }
      return;
    }
    const addBtn = e.target.closest('.items-add-btn');
    if (addBtn) {
      e.preventDefault();
      const agentIndex = parseInt(addBtn.dataset.agent);
      if (!isNaN(agentIndex)) {
        openItemsModal(agentIndex);
      }
      return;
    }
    const removeBtn = e.target.closest('.item-remove-btn');
    if (removeBtn) {
      e.preventDefault();
      const agentIndex = parseInt(removeBtn.dataset.agent);
      const itemIndex = parseInt(removeBtn.dataset.itemIndex);
      if (!isNaN(agentIndex) && !isNaN(itemIndex) && itemIndex > 0 && statuses?.agents?.[agentIndex]) {
        statuses.agents[agentIndex].申领物.splice(itemIndex, 1);
        renderAgentCards();
      }
      return;
    }
    const changeAbilityBtn = e.target.closest('.ability-change-btn');
    if (changeAbilityBtn) {
      e.preventDefault();
      const agentIndex = parseInt(changeAbilityBtn.dataset.agent);
      const abilityIndex = parseInt(changeAbilityBtn.dataset.abilityIndex);
      if (!isNaN(agentIndex) && !isNaN(abilityIndex)) {
        openChangeAbilityModal(agentIndex, abilityIndex);
      }
      return;
    }
    const anomalyAddBtn = e.target.closest('.anomaly-abilities-add-btn');
    if (anomalyAddBtn) {
      e.preventDefault();
      const agentIndex = parseInt(anomalyAddBtn.dataset.agent);
      if (!isNaN(agentIndex)) openAddAbilityModal(agentIndex);
      return;
    }
    const abilityRemoveBtn = e.target.closest('.ability-remove-btn');
    if (abilityRemoveBtn) {
      e.preventDefault();
      const agentIndex = parseInt(abilityRemoveBtn.dataset.agent);
      const abilityIndex = parseInt(abilityRemoveBtn.dataset.abilityIndex);
      const agent = statuses?.agents?.[agentIndex];
      if (!isNaN(agentIndex) && !isNaN(abilityIndex) && agent?.arc?.异常?.abilities) {
        agent.arc.异常.abilities.splice(abilityIndex, 1);
        renderAgentCards();
        showToast('已删除能力');
      }
      return;
    }
    const relAddBtn = e.target.closest('.relationships-add-btn');
    if (relAddBtn) {
      e.preventDefault();
      const agentIndex = parseInt(relAddBtn.dataset.agent);
      if (!isNaN(agentIndex)) openRelationshipModal(agentIndex, null);
      return;
    }
    const relEditBtn = e.target.closest('.rel-edit-btn');
    if (relEditBtn) {
      e.preventDefault();
      const agentIndex = parseInt(relEditBtn.dataset.agent);
      const relIndex = parseInt(relEditBtn.dataset.relIndex);
      if (!isNaN(agentIndex) && !isNaN(relIndex)) openRelationshipModal(agentIndex, relIndex);
      return;
    }
    const relRemoveBtn = e.target.closest('.rel-remove-btn');
    if (relRemoveBtn) {
      e.preventDefault();
      const agentIndex = parseInt(relRemoveBtn.dataset.agent);
      const relIndex = parseInt(relRemoveBtn.dataset.relIndex);
      const agent = statuses?.agents?.[agentIndex];
      if (!isNaN(agentIndex) && !isNaN(relIndex) && agent) {
        agent.arc = agent.arc || {};
        agent.arc.现实 = agent.arc.现实 || {};
        agent.arc.现实.关系 = agent.arc.现实.关系 || [];
        agent.arc.现实.关系.splice(relIndex, 1);
        renderAgentCards();
        showToast('已删除关系');
      }
      return;
    }
  });

  const switchRealityOverlay = document.getElementById('switchRealityModalOverlay');
  const switchRealityCloseBtn = switchRealityOverlay?.querySelector('.modal-close');
  switchRealityOverlay?.addEventListener('click', (e) => {
    if (e.target === switchRealityOverlay) closeSwitchRealityModal();
  });
  switchRealityCloseBtn?.addEventListener('click', closeSwitchRealityModal);

  const overlay = document.getElementById('itemsModalOverlay');
  const closeBtn = overlay?.querySelector('.modal-close');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeItemsModal();
  });
  closeBtn?.addEventListener('click', closeItemsModal);

  const searchInput = document.getElementById('itemsModalSearch');
  searchInput?.addEventListener('input', () => renderItemsModalList(searchInput.value));
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeItemsModal();
  });

  const changeAbilityOverlay = document.getElementById('changeAbilityModalOverlay');
  const changeAbilityCloseBtn = changeAbilityOverlay?.querySelector('.modal-close');
  changeAbilityOverlay?.addEventListener('click', (e) => {
    if (e.target === changeAbilityOverlay) closeChangeAbilityModal();
  });
  changeAbilityCloseBtn?.addEventListener('click', closeChangeAbilityModal);
  document.getElementById('changeAbilitySubmit')?.addEventListener('click', submitChangeAbility);

  const relationshipOverlay = document.getElementById('relationshipModalOverlay');
  const relationshipCloseBtn = relationshipOverlay?.querySelector('.modal-close');
  relationshipOverlay?.addEventListener('click', (e) => {
    if (e.target === relationshipOverlay) closeRelationshipModal();
  });
  relationshipCloseBtn?.addEventListener('click', closeRelationshipModal);
  document.getElementById('relationshipSubmit')?.addEventListener('click', submitRelationship);

  const addAbilityOverlay = document.getElementById('addAbilityModalOverlay');
  const addAbilityCloseBtn = addAbilityOverlay?.querySelector('.modal-close');
  addAbilityOverlay?.addEventListener('click', (e) => {
    if (e.target === addAbilityOverlay) closeAddAbilityModal();
  });
  addAbilityCloseBtn?.addEventListener('click', closeAddAbilityModal);
  document.getElementById('addAbilitySubmit')?.addEventListener('click', submitAddAbility);

  async function openInMailModal() {
    try {
      const res = await fetch(`${API_BASE}/api/in-mail`);
      const data = res.ok ? await res.json() : { email: null };
      const email = data?.email;
      document.getElementById('inMailTitle').value = email?.title ?? '';
      document.getElementById('inMailContent').value = email?.content ?? '';
      document.getElementById('inMailModalOverlay').classList.add('open');
    } catch (e) {
      document.getElementById('inMailTitle').value = '';
      document.getElementById('inMailContent').value = '';
      document.getElementById('inMailModalOverlay').classList.add('open');
    }
  }
  function closeInMailModal() {
    document.getElementById('inMailModalOverlay').classList.remove('open');
  }
  async function submitInMail() {
    const title = document.getElementById('inMailTitle').value.trim();
    const content = document.getElementById('inMailContent').value.trim();
    try {
      const res = await fetch(`${API_BASE}/api/in-mail`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: { title, content } })
      });
      if (!res.ok) throw new Error('保存失败');
      closeInMailModal();
      showToast('邮件已发送');
    } catch (e) {
      showToast(e.message || '保存失败');
    }
  }
  async function clearInMail() {
    try {
      const res = await fetch(`${API_BASE}/api/in-mail`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: null })
      });
      if (!res.ok) throw new Error('清除失败');
      document.getElementById('inMailTitle').value = '';
      document.getElementById('inMailContent').value = '';
      closeInMailModal();
      showToast('已清除邮件');
    } catch (e) {
      showToast(e.message || '清除失败');
    }
  }
  document.getElementById('inMailBtn')?.addEventListener('click', openInMailModal);
  const inMailOverlay = document.getElementById('inMailModalOverlay');
  inMailOverlay?.addEventListener('click', (e) => {
    if (e.target === inMailOverlay) closeInMailModal();
  });
  inMailOverlay?.querySelector('.modal-close')?.addEventListener('click', closeInMailModal);
  document.getElementById('inMailSaveBtn')?.addEventListener('click', submitInMail);
  document.getElementById('inMailClearBtn')?.addEventListener('click', clearInMail);

  function openGmInfoModal() {
    const gm = statuses?.gm || {};
    document.getElementById('gmModalName').value = gm.name ?? '';
    document.getElementById('gmModalAka').value = gm.aka ?? '';
    document.getElementById('gmModalLore').value = gm.lore ?? '';
    document.getElementById('gmInfoModalOverlay').classList.add('open');
  }
  function closeGmInfoModal() {
    document.getElementById('gmInfoModalOverlay').classList.remove('open');
  }
  async function submitGmInfoModal() {
    if (!statuses) return;
    statuses.gm = statuses.gm || {};
    statuses.gm.name = document.getElementById('gmModalName').value.trim();
    statuses.gm.aka = document.getElementById('gmModalAka').value.trim();
    statuses.gm.lore = document.getElementById('gmModalLore').value.trim();
    closeGmInfoModal();
    try {
      const res = await fetch(`${API_BASE}/api/statuses`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statuses)
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('GM 信息已保存');
    } catch (err) {
      showToast('保存失败: ' + err.message);
    }
  }
  document.getElementById('gmInfoBtn')?.addEventListener('click', openGmInfoModal);
  const gmInfoOverlay = document.getElementById('gmInfoModalOverlay');
  gmInfoOverlay?.addEventListener('click', (e) => {
    if (e.target === gmInfoOverlay) closeGmInfoModal();
  });
  gmInfoOverlay?.querySelector('.modal-close')?.addEventListener('click', closeGmInfoModal);
  document.getElementById('gmInfoSubmit')?.addEventListener('click', submitGmInfoModal);

  const newItemOverlay = document.getElementById('newItemModalOverlay');
  const newMissionOverlay = document.getElementById('newMissionModalOverlay');
  const chaosEffectOverlay = document.getElementById('chaosEffectModalOverlay');
  const chaosEffectConfirmOverlay = document.getElementById('chaosEffectConfirmModalOverlay');
  const secondaryAnomalyOverlay = document.getElementById('secondaryAnomalyModalOverlay');
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && newMissionOverlay?.classList.contains('open')) document.getElementById('newMissionModalOverlay').classList.remove('open');
    if (e.key === 'Escape' && overlay?.classList.contains('open')) closeItemsModal();
    if (e.key === 'Escape' && switchRealityOverlay?.classList.contains('open')) closeSwitchRealityModal();
    if (e.key === 'Escape' && changeAbilityOverlay?.classList.contains('open')) closeChangeAbilityModal();
    if (e.key === 'Escape' && newItemOverlay?.classList.contains('open')) closeNewItemModal();
    if (e.key === 'Escape' && relationshipOverlay?.classList.contains('open')) closeRelationshipModal();
    if (e.key === 'Escape' && addAbilityOverlay?.classList.contains('open')) closeAddAbilityModal();
    if (e.key === 'Escape' && inMailOverlay?.classList.contains('open')) closeInMailModal();
    if (e.key === 'Escape' && gmInfoOverlay?.classList.contains('open')) closeGmInfoModal();
    if (e.key === 'Escape' && chaosEffectOverlay?.classList.contains('open')) closeRefModal('chaosEffectModalOverlay');
    if (e.key === 'Escape' && chaosEffectConfirmOverlay?.classList.contains('open')) document.getElementById('chaosEffectConfirmModalOverlay').classList.remove('open');
    if (e.key === 'Escape' && secondaryAnomalyOverlay?.classList.contains('open')) closeRefModal('secondaryAnomalyModalOverlay');
  });
}

function collectFormData() {
  if (!statuses) return;
  statuses.agency = statuses.agency || {};
  statuses.agency.混沌值 = parseInt(document.getElementById('chaosValue').value) || 0;
  statuses.agency.散逸端 = parseInt(document.getElementById('looseEnds').value) || 0;

  selectedAgentIndices.forEach(index => {
    const agent = statuses.agents[index];
    const card = document.querySelector(`.agent-card[data-agent-index="${index}"]`);
    if (!card) return;

    agent.嘉奖 = parseInt(card.querySelector(`input[data-score="嘉奖"]`)?.value) || 0;
    agent.申诫 = parseInt(card.querySelector(`input[data-score="申诫"]`)?.value) || 0;
    agent.察看期 = parseInt(card.querySelector(`input[data-score="察看期"]`)?.value) || 0;
    agent.mvp = parseInt(card.querySelector(`input[data-score="mvp"]`)?.value) || 0;
    agent.flag = card.querySelector(`input[data-field="flag"]`)?.checked || false;
    agent.socks = card.querySelector(`input[data-field="socks"]`)?.checked || false;

    const titleSelect = card.querySelector(`select[data-field="机构头衔"]`);
    agent.机构头衔 = titleSelect?.value?.trim() || undefined;

    agent.arc = agent.arc || {};
    agent.arc.异常 = agent.arc.异常 || {};
    const anomalyAbilities = agent.arc.异常.abilities || [];
    anomalyAbilities.forEach((ab, i) => {
      if (ab.wellKnown == null && ab.已练习 === undefined) return;
      const cb = card.querySelector(`input[data-anomaly-proficient][data-ability-index="${i}"]`);
      if (cb) ab.已练习 = cb.checked;
      if (ab.wellKnown == null) return;
      const wk = ab.wellKnown || { a: 0, b: 0 };
      for (const key of ['a', 'b']) {
        const inputs = [...card.querySelectorAll(`input[data-anomaly-wellknown][data-ability-index="${i}"][data-well-known="${key}"]`)];
        inputs.sort((x, y) => parseInt(x.dataset.boxIndex, 10) - parseInt(y.dataset.boxIndex, 10));
        let count = 0;
        for (const input of inputs) {
          if (input.checked) count++;
          else break;
        }
        wk[key] = Math.min(3, Math.max(0, count));
      }
      ab.wellKnown = wk;
    });

    agent.arc.现实 = agent.arc.现实 || {};
    agent.arc.现实.割裂进度 = Math.min(4, Math.max(0, parseInt(card.querySelector(`input[data-reality-split]`)?.value) || 0));

    agent.qa = agent.qa || {};
    QA_QUALITIES.forEach(q => {
      const maxInput = card.querySelector(`input[data-qa="${q}"][data-type="max"]`);
      const currentInput = card.querySelector(`input[data-qa="${q}"][data-type="current"]`);
      const maxVal = maxInput?.value ?? '';
      agent.qa[q] = maxVal === '' ? 0 : (parseInt(maxVal) || 0);
      const currentVal = parseInt(currentInput?.value) || 0;
      if (!qaCurrentByAgent[index]) qaCurrentByAgent[index] = {};
      qaCurrentByAgent[index][q] = Math.min(Math.max(0, currentVal), agent.qa[q]);
    });
  });
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addNews() {
  const input = document.getElementById('newsText');
  const text = input.value.trim();
  if (!text) return;
  const today = todayLocal();
  statuses.agency = statuses.agency || {};
  statuses.agency.news = statuses.agency.news || [];
  statuses.agency.news.unshift({ date: today, text });
  input.value = '';
  renderNews();
}

function removeNews(index) {
  if (!statuses?.agency?.news) return;
  statuses.agency.news.splice(index, 1);
  renderNews();
}

async function save() {
  if (!statuses) {
    showToast('数据未加载，无法保存');
    return;
  }
  collectFormData();
  try {
    const res = await fetch(`${API_BASE}/api/statuses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statuses)
    });
    if (!res.ok) throw new Error(await res.text());
    showToast('已保存');
  } catch (err) {
    showToast('保存失败: ' + err.message);
  }
}

async function initStatuses() {
  const warning = '初始化将把 statuses.json 与 mission.json 重置为默认（机构归零、空动态、空特工、空任务报告），当前所有数据将丢失且无法恢复。\n\n确定继续？';
  if (!confirm(warning)) return;
  const defaultStatuses = {
    agency: { 混沌值: 0, 散逸端: 0, news: [] },
    gm: { name: '', aka: '', lore: '' },
    agents: []
  };
  try {
    const res = await fetch(`${API_BASE}/api/statuses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaultStatuses)
    });
    if (!res.ok) throw new Error(await res.text());
    const missionsRes = await fetch(`${API_BASE}/api/missions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missions: [] })
    });
    if (!missionsRes.ok) throw new Error(await missionsRes.text());
    await load();
    showToast('已初始化 statuses.json 与 mission.json');
  } catch (err) {
    showToast('初始化失败: ' + err.message);
  }
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDescriptionWithOutcomes(str) {
  if (!str) return '';
  const escaped = escapeHtml(str);
  return escaped
    .replace(/成功时/g, '<span class="outcome-label">成功时</span>')
    .replace(/失败时/g, '<span class="outcome-label">失败时</span>');
}

function openNewAgentModal() {
  if (!arcReference) return;
  const anomalySelect = document.getElementById('newAgentAnomaly');
  const realitySelect = document.getElementById('newAgentReality');
  const competencySelect = document.getElementById('newAgentCompetency');

  anomalySelect.innerHTML = '<option value="">— 选择异常 —</option>' +
    (arcReference.异常 || []).map(a => `<option value="${escapeHtml(a.id || '')}">${escapeHtml(a.id || '')}</option>`).join('');
  realitySelect.innerHTML = '<option value="">— 选择现实 —</option>' +
    (arcReference.现实 || []).map(r => `<option value="${escapeHtml(r.id || '')}">${escapeHtml(r.id || '')}</option>`).join('');
  competencySelect.innerHTML = '<option value="">— 选择职能 —</option>' +
    (arcReference.职能 || []).map(c => `<option value="${escapeHtml(c.id || '')}">${escapeHtml(c.id || '')}</option>`).join('');

  document.getElementById('newAgentName').value = '';
  document.getElementById('newAgentAka').value = '';
  document.getElementById('newAgentModalOverlay').classList.add('open');
}

function closeNewAgentModal() {
  document.getElementById('newAgentModalOverlay').classList.remove('open');
}

function openNewItemModal() {
  document.getElementById('newItemName').value = '';
  document.getElementById('newItemPrice').value = '';
  document.getElementById('newItemDesc').value = '';
  document.getElementById('newItemModalOverlay').classList.add('open');
  document.getElementById('newItemName').focus();
}

function closeNewItemModal() {
  document.getElementById('newItemModalOverlay').classList.remove('open');
}

async function createNewItem() {
  const name = document.getElementById('newItemName').value.trim();
  const price = parseInt(document.getElementById('newItemPrice').value, 10) || 0;
  const description = document.getElementById('newItemDesc').value.trim();

  if (!name) {
    showToast('请输入申领物名称');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, description })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 404) {
        throw new Error('API 未找到。请运行 cd agencyOS/gm-editor && node server.js，然后访问 http://localhost:3001');
      }
      throw new Error(err.error || res.statusText);
    }
    const itemsRes = await fetch(`${API_BASE}/api/items`);
    itemsCatalog = itemsRes.ok ? (await itemsRes.json()) : { items: [] };
    closeNewItemModal();
    showToast('已创建申领物：' + name);
  } catch (err) {
    showToast('创建失败: ' + err.message);
  }
}

function createNewAgent() {
  const name = document.getElementById('newAgentName').value.trim();
  const aka = document.getElementById('newAgentAka').value.trim();
  const anomaly = document.getElementById('newAgentAnomaly').value;
  const reality = document.getElementById('newAgentReality').value;
  const competency = document.getElementById('newAgentCompetency').value;

  if (!name) {
    showToast('请输入姓名');
    return;
  }
  if (!anomaly || !reality || !competency) {
    showToast('请选择异常、现实和职能');
    return;
  }

  const maxId = (statuses.agents || []).reduce((max, a) => {
    const m = /^agent-(\d+)$/.exec(a.id || '');
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const newId = `agent-${maxId + 1}`;

  const anomalyRef = arcReference?.异常?.find(a => a.id === anomaly);
  const realityRef = arcReference?.现实?.find(r => r.id === reality);
  const competencyRef = arcReference?.职能?.find(c => c.id === competency);

  const initialItem = competencyRef?.初始申领物
    ? { name: competencyRef.初始申领物.name || '', description: competencyRef.初始申领物.description || '' }
    : null;

  const arc异常 = {
    choice: anomaly,
    abilities: (anomalyRef?.abilities || []).map(ab => ({
      ...ab,
      已练习: false,
      wellKnown: { a: 0, b: 0 }
    }))
  };
  const arc现实 = {
    choice: reality,
    割裂进度: 0,
    关系: [],
    ...(realityRef?.现实触发器 && { 现实触发器: { ...realityRef.现实触发器 } }),
    ...(realityRef?.过载解除 && { 过载解除: { ...realityRef.过载解除 } })
  };
  const arc职能 = {
    choice: competency,
    ...(competencyRef?.首要指令 && { 首要指令: { ...competencyRef.首要指令 } }),
    ...(competencyRef?.许可行为 && { 许可行为: [...(competencyRef.许可行为 || [])] })
  };

  const newAgent = {
    id: newId,
    name,
    aka: aka || undefined,
    arc: {
      异常: arc异常,
      现实: arc现实,
      职能: arc职能
    },
    wallTracks: {
      职能: { marked: 0, struck: 0 },
      现实: { marked: 0, struck: 0 },
      异常: { marked: 0, struck: 0 }
    },
    qa: Object.fromEntries(QA_QUALITIES.map(q => [q, 0])),
    嘉奖: 0,
    申诫: 0,
    察看期: 0,
    mvp: 0,
    flag: false,
    socks: false,
    申领物: initialItem ? [initialItem] : []
  };

  statuses.agents = statuses.agents || [];
  statuses.agents.push(newAgent);
  selectedAgentIndices.add(statuses.agents.length - 1);
  closeNewAgentModal();
  render();
  showToast('已创建特工：' + name);
}

document.getElementById('saveBtn').addEventListener('click', save);
document.getElementById('initBtn').addEventListener('click', initStatuses);
document.getElementById('looseEnds')?.addEventListener('input', renderAgencyLimits);
document.getElementById('looseEnds')?.addEventListener('change', renderAgencyLimits);
document.getElementById('addNewsBtn').addEventListener('click', addNews);
document.getElementById('newsText').addEventListener('keydown', e => {
  if (e.key === 'Enter') addNews();
});

function openNewMissionModal() {
  document.getElementById('missionStatus').value = '已中和';
  document.getElementById('missionCodename').value = '';
  document.getElementById('missionBehavior').value = '';
  document.getElementById('missionFocus').value = '';
  document.getElementById('missionDomain').value = '';
  document.getElementById('missionParticipants').value = '';
  document.getElementById('missionObservation').value = '';
  document.getElementById('missionMvp').value = '';
  document.getElementById('missionRating').value = '';
  document.getElementById('newMissionModalOverlay').classList.add('open');
}

async function createNewMission() {
  const mission = {
    异常状态: document.getElementById('missionStatus').value,
    代号: document.getElementById('missionCodename').value.trim(),
    行为: document.getElementById('missionBehavior').value.trim(),
    焦点: document.getElementById('missionFocus').value.trim(),
    领域: document.getElementById('missionDomain').value.trim(),
    参与者: document.getElementById('missionParticipants').value.trim(),
    察看期: document.getElementById('missionObservation').value.trim(),
    MVP: document.getElementById('missionMvp').value.trim(),
    最终评级: document.getElementById('missionRating').value.trim()
  };
  try {
    const res = await fetch(`${API_BASE}/api/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mission)
    });
    if (!res.ok) {
      const text = await res.text();
      let errMsg = text;
      try {
        const parsed = JSON.parse(text);
        if (parsed.error) errMsg = parsed.error;
      } catch (_) {}
      throw new Error(errMsg);
    }
    document.getElementById('newMissionModalOverlay').classList.remove('open');
    showToast('已创建任务报告');
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      showToast('创建失败: 无法连接服务器，请确保已运行 node server.js (端口 3001)');
    } else {
      showToast('创建失败: ' + msg);
    }
  }
}

document.getElementById('newMissionBtn').addEventListener('click', openNewMissionModal);
document.getElementById('newMissionSubmit').addEventListener('click', createNewMission);
document.getElementById('newMissionModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'newMissionModalOverlay') document.getElementById('newMissionModalOverlay').classList.remove('open');
});
document.getElementById('newMissionModal').querySelector('.modal-close').addEventListener('click', () => {
  document.getElementById('newMissionModalOverlay').classList.remove('open');
});

document.getElementById('newAgentBtn').addEventListener('click', openNewAgentModal);
document.getElementById('newAgentSubmit').addEventListener('click', createNewAgent);

document.getElementById('newAgentModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'newAgentModalOverlay') closeNewAgentModal();
});
document.getElementById('newAgentModal').querySelector('.modal-close').addEventListener('click', closeNewAgentModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('newAgentModalOverlay').classList.contains('open')) closeNewAgentModal();
});

let chaosEffectConfirmCost = 0;
let chaosEffectConfirmEffect = '';

document.getElementById('chaosEffectBtn').addEventListener('click', () => {
  document.getElementById('chaosEffectModalOverlay').classList.add('open');
});

document.getElementById('chaosEffectModal').querySelector('tbody').addEventListener('click', (e) => {
  const row = e.target.closest('.chaos-effect-row');
  if (!row) return;
  const cost = parseInt(row.dataset.cost, 10);
  const effect = row.dataset.effect || '';
  chaosEffectConfirmCost = cost;
  chaosEffectConfirmEffect = effect;
  document.getElementById('chaosEffectConfirmTitle').textContent = `确认创建：${effect}`;
  document.getElementById('chaosEffectConfirmInfo').textContent = `效果「${effect}」— 单次代价 ${cost} 混沌值`;
  const countInput = document.getElementById('chaosEffectCount');
  countInput.value = 1;
  countInput.min = 1;
  updateChaosEffectTotal();
  document.getElementById('chaosEffectModalOverlay').classList.remove('open');
  document.getElementById('chaosEffectConfirmModalOverlay').classList.add('open');
});

function updateChaosEffectTotal() {
  const count = Math.max(1, parseInt(document.getElementById('chaosEffectCount').value, 10) || 1);
  const total = chaosEffectConfirmCost * count;
  document.getElementById('chaosEffectTotal').textContent = `共消耗：${total} 混沌值`;
}

document.getElementById('chaosEffectCount').addEventListener('input', updateChaosEffectTotal);

document.getElementById('chaosEffectConfirmCancel').addEventListener('click', () => {
  document.getElementById('chaosEffectConfirmModalOverlay').classList.remove('open');
});

document.getElementById('chaosEffectConfirmSubmit').addEventListener('click', async () => {
  const count = Math.max(1, parseInt(document.getElementById('chaosEffectCount').value, 10) || 1);
  const totalCost = chaosEffectConfirmCost * count;
  const currentChaos = parseInt(document.getElementById('chaosValue').value, 10) || 0;
  if (totalCost > currentChaos) {
    showToast('混沌值不足');
    return;
  }
  const newChaos = currentChaos - totalCost;
  statuses.agency = statuses.agency || {};
  statuses.agency.混沌值 = newChaos;
  document.getElementById('chaosValue').value = newChaos;
  document.getElementById('chaosEffectConfirmModalOverlay').classList.remove('open');
  try {
    const res = await fetch(`${API_BASE}/api/statuses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statuses)
    });
    if (!res.ok) throw new Error(await res.text());
    showToast(`已创建 ${count} 次「${chaosEffectConfirmEffect}」，消耗 ${totalCost} 混沌值`);
  } catch (err) {
    showToast('保存失败: ' + err.message);
  }
});

document.getElementById('chaosEffectConfirmModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'chaosEffectConfirmModalOverlay') document.getElementById('chaosEffectConfirmModalOverlay').classList.remove('open');
});
document.getElementById('chaosEffectConfirmModal').querySelector('.modal-close').addEventListener('click', () => {
  document.getElementById('chaosEffectConfirmModalOverlay').classList.remove('open');
});
document.getElementById('secondaryAnomalyBtn').addEventListener('click', () => {
  document.getElementById('secondaryAnomalyModalOverlay').classList.add('open');
});

function closeRefModal(overlayId) {
  document.getElementById(overlayId).classList.remove('open');
}

document.getElementById('chaosEffectModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'chaosEffectModalOverlay') closeRefModal('chaosEffectModalOverlay');
});
document.getElementById('chaosEffectModal').querySelector('.modal-close').addEventListener('click', () => closeRefModal('chaosEffectModalOverlay'));

document.getElementById('secondaryAnomalyModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'secondaryAnomalyModalOverlay') closeRefModal('secondaryAnomalyModalOverlay');
});
document.getElementById('secondaryAnomalyModal').querySelector('.modal-close').addEventListener('click', () => closeRefModal('secondaryAnomalyModalOverlay'));

document.getElementById('newItemBtn').addEventListener('click', openNewItemModal);
document.getElementById('newItemSubmit').addEventListener('click', createNewItem);

document.getElementById('newItemModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'newItemModalOverlay') closeNewItemModal();
});
document.getElementById('newItemModal').querySelector('.modal-close').addEventListener('click', closeNewItemModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('newItemModalOverlay').classList.contains('open')) closeNewItemModal();
});

setupItemsDelegation();
load();
