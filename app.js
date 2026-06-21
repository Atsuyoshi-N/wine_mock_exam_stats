(function () {
  'use strict';

  // ===== 定数 =====

  const COLORS = {
    primary: '#8b0000',
    correct: '#2e7d32',
    incorrect: '#c62828',
    partial: '#e65100',
    grid: '#ececec',
    text: '#666',
  };

  const SUBJECT_NAMES = {
    'INTRO': 'ワイン概論',
    'FRANCE': 'フランス（総合）',
    'BORDEAUX': 'ボルドー',
    'BOURGOGNE': 'ブルゴーニュ',
    'CHAMPAGNE': 'シャンパーニュ',
    'RHONE': 'ローヌ',
    'LOIRE': 'ロワール',
    'ALSACE': 'アルザス',
    'PROVENCE': 'プロヴァンス',
    'LANGUEDOC-ROUSSILLON': 'ラングドック・ルーション',
    'JURA-SAVOIE': 'ジュラ・サヴォワ',
    'SUD-OUEST': '南西地方',
    'VDN-VDL-NOUVEAU': 'VDN・VDL・ヌーヴォー',
    'ITALY': 'イタリア',
    'SPAIN': 'スペイン',
    'PORTUGAL': 'ポルトガル',
    'GERMANY': 'ドイツ',
    'AUSTRIA': 'オーストリア',
    'SWISS': 'スイス',
    'HUNGARY': 'ハンガリー',
    'GREECE': 'ギリシャ',
    'BULGARIA': 'ブルガリア',
    'SLOVENIA': 'スロヴェニア',
    'UNITED-KINGDOM': 'イギリス',
    'USA': 'アメリカ',
    'CANADA': 'カナダ',
    'CHILE': 'チリ',
    'ARGENTINA': 'アルゼンチン',
    'URUGUAY': 'ウルグアイ',
    'AUSTRALIA': 'オーストラリア',
    'NEW-ZEALAND': 'ニュージーランド',
    'SOUTH-AFRICA': '南アフリカ',
    'JAPAN': '日本',
    'SAKE': '日本酒・焼酎',
    'SERVICE': 'サービス',
    'CUISINE': '料理・チーズ',
    'MANAGEMENT': '経営・法律',
    'TASTING': 'テイスティング',
    'MAP': '地図問題',
  };

  function subjectName(key) {
    return SUBJECT_NAMES[key] || key;
  }

  // ===== 状態 =====

  let history = [];
  let currentExam = null;
  let currentSubject = null;
  let currentGistId = null;
  let subjectSortState = { col: 'rate', dir: 'asc' };
  let currentSubjectEntries = [];

  // ===== ソート =====

  function sortSubjectEntries(entries) {
    const { col, dir } = subjectSortState;
    return [...entries].sort((a, b) => {
      const sa = a[1], sb = b[1];
      let va = 0, vb = 0;
      switch (col) {
        case 'rate':
          va = sa.maxPoints > 0 ? sa.earnedPoints / sa.maxPoints : 0;
          vb = sb.maxPoints > 0 ? sb.earnedPoints / sb.maxPoints : 0;
          break;
        case 'correct':   va = sa.correct;   vb = sb.correct;   break;
        case 'incorrect': va = sa.incorrect; vb = sb.incorrect; break;
        case 'total':     va = sa.total;     vb = sb.total;     break;
      }
      return dir === 'asc' ? va - vb : vb - va;
    });
  }

  // ===== Gist ID 管理 =====

  function getGistId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('gist') || localStorage.getItem('wine_gist_id') || null;
  }

  function saveGistId(id) {
    localStorage.setItem('wine_gist_id', id);
    currentGistId = id;
  }

  function clearGistId() {
    localStorage.removeItem('wine_gist_id');
    currentGistId = null;
  }

  // ===== Gist からデータを取得 =====

  async function fetchFromGist(gistId) {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error('Gist が見つかりません。IDが正しいか確認してください');
      throw new Error(`データ取得エラー: HTTP ${res.status}`);
    }
    const gist = await res.json();
    const file = gist.files['wine_exam_history.json'];
    if (!file) throw new Error('Gist にデータファイルが含まれていません');
    return JSON.parse(file.content);
  }

  // ===== 画面遷移 =====

  function showSetup() {
    document.getElementById('gist-setup').style.display = 'flex';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('dashboard-main').style.display = 'none';
    document.getElementById('refresh-btn').style.display = 'none';
    document.getElementById('change-gist-btn').style.display = 'none';
  }

  function showLoading() {
    document.getElementById('gist-setup').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('dashboard-main').style.display = 'none';
  }

  function showError(msg) {
    document.getElementById('gist-setup').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
    document.getElementById('dashboard-main').style.display = 'none';
    document.getElementById('error-msg').textContent = msg;
  }

  function showDashboard() {
    document.getElementById('gist-setup').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('dashboard-main').style.display = 'block';
    document.getElementById('refresh-btn').style.display = 'inline-block';
    document.getElementById('change-gist-btn').style.display = 'inline-block';
    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('last-updated').textContent = `更新: ${now}`;
  }

  // ===== データ読み込みとレンダリング =====

  async function loadAndRender(gistId) {
    showLoading();
    try {
      const data = await fetchFromGist(gistId);
      saveGistId(gistId);
      history = data.sort((a, b) => new Date(a.date) - new Date(b.date));
      renderDashboard();
      showDashboard();
    } catch (e) {
      showError(e.message);
    }
  }

  function renderDashboard() {
    if (history.length === 0) {
      document.getElementById('no-data').style.display = 'block';
      document.getElementById('dashboard-content').style.display = 'none';
      return;
    }
    document.getElementById('no-data').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'block';

    populateExamSelect();
    currentExam = history[history.length - 1];
    document.getElementById('exam-select').value = currentExam.id;

    renderAll();
  }

  // ===== 試験選択 =====

  function populateExamSelect() {
    const select = document.getElementById('exam-select');
    const sorted = [...history].reverse();
    select.innerHTML = sorted.map(ex => {
      const d = new Date(ex.date);
      const dateStr = d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const typeLabel = ex.examType === 'exam' ? '模試' : '問題集';
      return `<option value="${ex.id}">[${typeLabel}] ${dateStr} — ${ex.percentage}% (${ex.totalScore}/${ex.maxScore}点)</option>`;
    }).join('');
  }

  function renderAll() {
    renderOverview();
    renderScoreTrend();
    renderSubjectBreakdown();
    populateSubjectSelect();
    renderSubjectTrend();
  }

  // ===== 概要カード =====

  function renderOverview() {
    if (!currentExam) return;
    document.getElementById('stat-score').textContent = `${currentExam.totalScore} / ${currentExam.maxScore}`;
    document.getElementById('stat-percentage').textContent = `${currentExam.percentage}%`;
    // 偏差値・判定は下でまとめて処理（passLine / percentile も活用するため）

    let totalCorrect = 0, totalIncorrect = 0;
    Object.values(currentExam.subjects || {}).forEach(s => {
      totalCorrect += s.correct;
      totalIncorrect += s.incorrect;
    });
    document.getElementById('stat-correct').textContent = `${totalCorrect}問`;
    document.getElementById('stat-incorrect').textContent = `${totalIncorrect}問`;

    // 判定: grade があればそれ、なければ模試の上位% を表示
    const gradeEl = document.getElementById('stat-grade');
    if (currentExam.grade) {
      gradeEl.textContent = currentExam.grade;
      gradeEl.title = '';
    } else if (currentExam.percentile != null) {
      gradeEl.textContent = `上位${currentExam.percentile}%`;
      gradeEl.title = '';
    } else {
      gradeEl.textContent = 'N/A';
    }

    // 偏差値: ホバーで合格ラインを表示
    const devEl = document.getElementById('stat-deviation');
    devEl.textContent = currentExam.deviation != null ? currentExam.deviation : 'N/A';
    devEl.title = currentExam.passLine != null
      ? `5年平均合格ライン: ${currentExam.passLine}`
      : '';
  }

  // ===== スコア推移 =====

  function getExamCategory(ex) {
    return ex.examCategory || (ex.examType === 'exam' ? 'exams' : null);
  }

  function renderScoreTrend() {
    const el = document.getElementById('score-trend-chart');
    const titleEl = document.getElementById('score-trend-title');

    const currentCat = getExamCategory(currentExam);
    const filtered = history.filter(ex => getExamCategory(ex) === currentCat);
    const typeLabel = currentExam?.examType === 'exam' ? '模試' : '問題集';
    if (titleEl) titleEl.textContent = `スコア推移（${typeLabel}）`;

    if (filtered.length < 2) {
      el.innerHTML = '<p class="chart-note">推移グラフは2回以上の試験データが必要です</p>';
      return;
    }
    const data = filtered.map(ex => ({
      label: fmtDate(ex.date),
      value: ex.percentage,
      highlight: ex.id === currentExam?.id,
    }));
    el.innerHTML = lineChart(data, { width: 800, height: 220, yMin: 0, yMax: 100, yLabel: '正答率 (%)', color: COLORS.primary });
  }

  // ===== 分野別成績 =====

  function renderSubjectBreakdown() {
    if (!currentExam) return;
    const subjects = currentExam.subjects || {};
    currentSubjectEntries = Object.entries(subjects);

    // 棒グラフは常に得点率昇順（苦手順）で固定
    const byRate = [...currentSubjectEntries].sort((a, b) => {
      const ra = a[1].maxPoints > 0 ? a[1].earnedPoints / a[1].maxPoints : 0;
      const rb = b[1].maxPoints > 0 ? b[1].earnedPoints / b[1].maxPoints : 0;
      return ra - rb;
    });
    document.getElementById('subject-bar-chart').innerHTML = subjectBarChart(byRate);
    document.getElementById('subject-table-wrap').innerHTML = subjectTable(currentSubjectEntries);
    attachSortHandlers();
  }

  function attachSortHandlers() {
    document.querySelectorAll('#subject-data-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (subjectSortState.col === col) {
          subjectSortState.dir = subjectSortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
          subjectSortState.col = col;
          subjectSortState.dir = 'asc';
        }
        document.getElementById('subject-table-wrap').innerHTML = subjectTable(currentSubjectEntries);
        attachSortHandlers();
      });
    });
  }

  // ===== 分野別推移 =====

  function populateSubjectSelect() {
    const allSubjects = new Set();
    history.forEach(ex => Object.keys(ex.subjects || {}).forEach(s => allSubjects.add(s)));
    const sorted = [...allSubjects].sort((a, b) => subjectName(a).localeCompare(subjectName(b), 'ja'));
    const select = document.getElementById('subject-select');
    select.innerHTML = sorted.map(s => `<option value="${s}">${subjectName(s)}</option>`).join('');
    if (!currentSubject || !allSubjects.has(currentSubject)) {
      currentSubject = sorted[0] || null;
    }
    select.value = currentSubject;
  }

  function renderSubjectTrend() {
    const el = document.getElementById('subject-trend-chart');
    if (!currentSubject) { el.innerHTML = ''; return; }
    const data = history
      .filter(ex => ex.subjects && ex.subjects[currentSubject])
      .map(ex => {
        const s = ex.subjects[currentSubject];
        const rate = s.maxPoints > 0 ? Math.round(s.earnedPoints / s.maxPoints * 1000) / 10 : 0;
        return { label: fmtDate(ex.date), value: rate, highlight: ex.id === currentExam?.id };
      });
    if (data.length < 2) {
      el.innerHTML = '<p class="chart-note">この分野の推移グラフは2回以上のデータが必要です</p>';
      return;
    }
    el.innerHTML = lineChart(data, { width: 800, height: 200, yMin: 0, yMax: 100, yLabel: '得点率 (%)', color: COLORS.correct });
  }

  // ===== SVG: 折れ線グラフ =====

  function lineChart(data, opts) {
    const { width = 800, height = 220, yMin = 0, yMax = 100, yLabel = '', color = '#8b0000' } = opts;
    const pL = 52, pR = 24, pT = 24, pB = 48;
    const cW = width - pL - pR;
    const cH = height - pT - pB;
    const n = data.length;

    const xOf = i => pL + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
    const yOf = v => pT + cH - ((v - yMin) / (yMax - yMin)) * cH;

    const yTicks = [0, 25, 50, 75, 100];
    const gridLines = yTicks.map(t => {
      const y = yOf(t);
      return `<line x1="${pL}" y1="${y}" x2="${pL + cW}" y2="${y}" stroke="${COLORS.grid}" stroke-width="1"/>
        <text x="${pL - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="${COLORS.text}">${t}</text>`;
    }).join('');

    const step = Math.max(1, Math.ceil(n / 10));
    const xLabels = data.map((d, i) => {
      if (i % step !== 0 && i !== n - 1) return '';
      return `<text x="${xOf(i)}" y="${pT + cH + 18}" text-anchor="middle" font-size="11" fill="${COLORS.text}">${d.label}</text>`;
    }).join('');

    const polyPoints = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ');

    const dots = data.map((d, i) => {
      const x = xOf(i), y = yOf(d.value);
      const r = d.highlight ? 6 : 4;
      const fill = d.highlight ? color : '#fff';
      const showLabel = d.highlight || i % step === 0 || i === n - 1;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${color}" stroke-width="2.5"/>
        ${showLabel ? `<text x="${x}" y="${y - 9}" text-anchor="middle" font-size="10" fill="${color}" font-weight="600">${d.value}%</text>` : ''}`;
    }).join('');

    const yLabelEl = `<text x="${pL - 38}" y="${pT + cH / 2}" text-anchor="middle"
      font-size="11" fill="${COLORS.text}"
      transform="rotate(-90 ${pL - 38} ${pT + cH / 2})">${yLabel}</text>`;

    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
      ${yLabelEl}${gridLines}
      <polyline points="${polyPoints}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${xLabels}
      <line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT + cH}" stroke="#ccc" stroke-width="1"/>
      <line x1="${pL}" y1="${pT + cH}" x2="${pL + cW}" y2="${pT + cH}" stroke="#ccc" stroke-width="1"/>
    </svg>`;
  }

  // ===== SVG: 横棒グラフ =====

  function subjectBarChart(entries) {
    if (entries.length === 0) return '<p class="chart-note">データなし</p>';
    const barH = 20, gap = 7, pL = 155, pR = 160, pT = 8, pB = 8;
    const totalW = 800;
    const cW = totalW - pL - pR;
    const totalH = entries.length * (barH + gap) + pT + pB;

    const bars = entries.map(([key, s], i) => {
      const y = pT + i * (barH + gap);
      const rate = s.maxPoints > 0 ? s.earnedPoints / s.maxPoints : 0;
      const fillW = rate * cW;
      const rateStr = Math.round(rate * 1000) / 10;
      const name = subjectName(key);
      const label = name.length > 11 ? name.slice(0, 10) + '…' : name;
      const barColor = rate >= 0.7 ? COLORS.correct : rate >= 0.5 ? COLORS.partial : COLORS.incorrect;
      return `
        <text x="${pL - 8}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="12" fill="#444">${label}</text>
        <rect x="${pL}" y="${y}" width="${cW}" height="${barH}" fill="#f0f0f0" rx="3"/>
        <rect x="${pL}" y="${y}" width="${fillW}" height="${barH}" fill="${barColor}" rx="3" opacity="0.85"/>
        <text x="${pL + cW + 6}" y="${y + barH / 2 + 4}" font-size="11" fill="#555">${rateStr}% (${s.correct}/${s.total}問)</text>`;
    }).join('');

    return `<svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">${bars}</svg>`;
  }

  // ===== 分野別テーブル（ソート対応） =====

  function subjectTable(rawEntries) {
    if (rawEntries.length === 0) return '';
    const entries = sortSubjectEntries(rawEntries);

    function sortTh(key, label) {
      const active = subjectSortState.col === key;
      const icon = active ? (subjectSortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<th class="sortable${active ? ' sort-active' : ''}" data-sort="${key}">${label}${icon}</th>`;
    }

    const rows = entries.map(([key, s]) => {
      const rate = s.maxPoints > 0 ? Math.round(s.earnedPoints / s.maxPoints * 1000) / 10 : 0;
      const rateClass = rate >= 70 ? 'rate-good' : rate >= 50 ? 'rate-mid' : 'rate-bad';
      const barColor = rate >= 70 ? COLORS.correct : rate >= 50 ? COLORS.partial : COLORS.incorrect;
      return `<tr>
        <td>${subjectName(key)}</td>
        <td>${s.total}</td>
        <td class="col-correct">${s.correct}</td>
        <td class="col-partial">${s.partial > 0 ? s.partial : '—'}</td>
        <td class="col-incorrect">${s.incorrect}</td>
        <td class="rate-bar-cell ${rateClass}">
          ${rate}%
          <div class="rate-bar-wrap"><div class="rate-bar" style="width:${rate}%;background:${barColor};"></div></div>
        </td>
      </tr>`;
    }).join('');

    return `<table class="subject-table" id="subject-data-table">
      <thead><tr>
        <th>分野</th>
        ${sortTh('total', '出題')}
        ${sortTh('correct', '正解')}
        <th>部分点</th>
        ${sortTh('incorrect', '不正解')}
        ${sortTh('rate', '得点率')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // ===== ユーティリティ =====

  function fmtDate(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ===== イベントリスナー =====

  function bindEvents() {
    document.getElementById('gist-load-btn').addEventListener('click', () => {
      const id = document.getElementById('gist-id-input').value.trim();
      if (!id) return;
      document.getElementById('setup-error').style.display = 'none';
      loadAndRender(id).catch(e => {
        document.getElementById('setup-error').textContent = e.message;
        document.getElementById('setup-error').style.display = 'block';
        showSetup();
      });
    });

    document.getElementById('gist-id-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('gist-load-btn').click();
    });

    document.getElementById('exam-select').addEventListener('change', e => {
      currentExam = history.find(ex => ex.id === e.target.value) || history[0];
      renderOverview();
      renderScoreTrend();
      renderSubjectBreakdown();
    });

    document.getElementById('subject-select').addEventListener('change', e => {
      currentSubject = e.target.value;
      renderSubjectTrend();
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
      if (currentGistId) loadAndRender(currentGistId);
    });

    document.getElementById('change-gist-btn').addEventListener('click', () => {
      clearGistId();
      document.getElementById('gist-id-input').value = '';
      showSetup();
    });

    document.getElementById('retry-btn').addEventListener('click', () => {
      if (currentGistId) loadAndRender(currentGistId);
      else showSetup();
    });
  }

  // ===== 起動 =====

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    const gistId = getGistId();
    if (gistId) {
      currentGistId = gistId;
      loadAndRender(gistId);
    } else {
      showSetup();
    }
  });
})();
