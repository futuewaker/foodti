/* ===========================================================
   FoodTI · 食格测试 — app.js
   基于 petti 模板的 IIFE 实现 · 糖果粉主题 · 闺蜜找搭子向
   =========================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------
  // 食物图片由 foods.json 的 image 字段提供
  // 隐藏款显示概率(每次结果命中)
  // ------------------------------------------------------------
  const HIDDEN_PROB = 0.5;

  // 移除原 pet-style mock,只在 fetch 失败时给出最小占位
  const MOCK_QUESTIONS = [
    {
      id: 1, dim: 'EI', weight: 2, trump: true,
      scene: '🍲', bubble: '闺蜜群召唤令',
      text: '题目加载失败,请确保用 HTTP 服务器打开。',
      options: [
        { label: '刷新一下', letter: 'E' },
        { label: '换种打开方式', letter: 'I' }
      ]
    }
  ];
  const MOCK_FOODS = [];

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  const state = {
    view: 'intro',
    questions: [],
    foods: [],
    currentIdx: 0,
    answers: [],
    result: null,
    isAnimating: false
  };

  const DIMS = ['EI', 'SN', 'TF', 'JP'];
  const POLES = { EI: ['E', 'I'], SN: ['S', 'N'], TF: ['T', 'F'], JP: ['J', 'P'] };
  const TASTE_LABELS = ['甜度', '咸度', '辣度', '酸度', '苦度', '鲜度'];

  const ANIM_MS = 280;
  const FLASH_MS = 320;
  const NEXT_DELAY = 260;

  // ------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    views: {
      intro:  $('view-intro'),
      quiz:   $('view-quiz'),
      result: $('view-result')
    },
    scrollRows: [$('scroll-row-1'), $('scroll-row-2'), $('scroll-row-3')],
    btnStart:        $('btn-start'),
    btnHome:         $('btn-home'),
    progressFill:    $('progress-fill'),
    progressCurrent: $('progress-current'),
    progressTotal:   $('progress-total'),
    scenarioEmoji:   $('scenario-emoji'),
    scenarioAvatarBox: document.querySelector('.scenario-avatar'),
    scenarioBubble:  $('scenario-bubble'),
    quizCard:        $('quiz-card'),
    qText:           $('q-text'),
    optionsList:     $('options-list'),
    btnPrev:         $('btn-prev'),
    btnNext:         $('btn-next'),
    resultImage:          $('result-image'),
    hiddenBadge:          $('hidden-badge'),
    resultNameTitle:      $('result-name-title'),
    resultName:           $('result-name'),
    resultMdValue:        $('result-md-value'),
    resultMdNote:         $('result-md-note'),
    resultNzValue:        $('result-nz-value'),
    resultNzNote:         $('result-nz-note'),
    resultQuote:          $('result-quote'),
    resultTags:           $('result-tags'),
    resultQuickReview:    $('result-quick-review'),
    resultInterpretation: $('result-interpretation'),
    resultCatchphrases:   $('result-catchphrases'),
    friendshipCards:      $('friendship-cards'),
    resultScene:          $('result-scene'),
    radarCanvas:          $('radar-canvas'),
    btnRestart:           $('btn-restart'),
    btnShare:             $('btn-share'),
    btnSaveLong:          $('btn-save-long'),
    saveLoading:          $('save-loading'),
    saveModal:            $('save-modal'),
    saveModalBackdrop:    $('save-modal-backdrop'),
    saveModalImg:         $('save-modal-img'),
    btnSaveClose:         $('btn-save-close'),
    viewResult:           $('view-result')
  };

  // ------------------------------------------------------------
  // Init — load JSON + render
  // ------------------------------------------------------------
  async function init() {
    const [questions, foods] = await Promise.all([
      loadJSON('data/questions.json', MOCK_QUESTIONS),
      loadJSON('data/foods.json',     MOCK_FOODS)
    ]);
    state.questions = (Array.isArray(questions) && questions.length) ? questions : MOCK_QUESTIONS;
    state.foods     = (Array.isArray(foods)     && foods.length)     ? foods     : MOCK_FOODS;

    el.progressTotal.textContent = state.questions.length;

    renderIntroGallery();
    bindEvents();
    render();
  }

  async function loadJSON(path, fallback) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } catch (err) {
      console.warn('[FoodTI] fallback to mock for', path, err.message);
      return fallback;
    }
  }

  // ------------------------------------------------------------
  // Intro marquee — 3 行食物图循环
  // ------------------------------------------------------------
  function renderIntroGallery() {
    if (!el.scrollRows || !el.scrollRows.every(Boolean)) return;
    const ids = state.foods.map((f) => f.id);
    if (!ids.length) return;

    const groups = [[], [], []];
    ids.forEach((id, idx) => groups[idx % 3].push(id));

    el.scrollRows.forEach((row, i) => {
      if (!row) return;
      const list = groups[i].concat(groups[i]);
      row.innerHTML = list
        .map((id) => {
          const f = state.foods.find((x) => x.id === id);
          const src = f ? f.image : '';
          return '<div class="food-pet"><img src="' + src + '" alt=""></div>';
        })
        .join('');
      const PET = 96, GAP = 14;
      row.style.width = (list.length * PET + (list.length - 1) * GAP) + 'px';
    });
  }

  // ------------------------------------------------------------
  // Events
  // ------------------------------------------------------------
  function bindEvents() {
    el.btnStart    && el.btnStart.addEventListener('click', startQuiz);
    el.btnHome     && el.btnHome.addEventListener('click',  goHome);
    el.btnPrev     && el.btnPrev.addEventListener('click',  previousQuestion);
    el.btnNext     && el.btnNext.addEventListener('click',  nextQuestion);
    el.btnRestart  && el.btnRestart.addEventListener('click', restart);
    el.btnShare    && el.btnShare.addEventListener('click',  shareLink);
    el.btnSaveLong && el.btnSaveLong.addEventListener('click', saveLongScreenshot);
    el.btnSaveClose && el.btnSaveClose.addEventListener('click', closeSaveModal);
    el.saveModalBackdrop && el.saveModalBackdrop.addEventListener('click', closeSaveModal);
  }

  // ------------------------------------------------------------
  // View routing
  // ------------------------------------------------------------
  function setView(name) {
    state.view = name;
    Object.entries(el.views).forEach(([k, node]) => {
      if (!node) return;
      node.classList.toggle('active', k === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    if (state.view === 'quiz')   renderQuiz();
    if (state.view === 'result') renderResult();
    setView(state.view);
  }

  // ------------------------------------------------------------
  // Intro / nav
  // ------------------------------------------------------------
  function startQuiz() {
    state.view = 'quiz';
    state.currentIdx = 0;
    state.answers = [];
    render();
  }
  function goHome() {
    if (state.isAnimating) return;
    state.view = 'intro';
    render();
  }

  // ------------------------------------------------------------
  // QUIZ
  // ------------------------------------------------------------
  function renderQuiz() {
    renderProgress();
    renderScenarioHint();
    renderQuestion();
    updateNavButtons();
  }

  function renderProgress() {
    const total = state.questions.length;
    const current = state.currentIdx + 1;
    el.progressTotal.textContent = total;
    el.progressCurrent.textContent = current;
    const pct = Math.round((current / total) * 100);
    el.progressFill.style.width = pct + '%';
  }

  function renderScenarioHint() {
    const q = state.questions[state.currentIdx];
    if (!q) return;
    el.scenarioBubble.textContent = q.bubble || '';
    if (el.scenarioEmoji) el.scenarioEmoji.textContent = q.scene || '🍴';
    if (el.scenarioAvatarBox) {
      el.scenarioAvatarBox.classList.remove('pop');
      // eslint-disable-next-line no-unused-expressions
      el.scenarioAvatarBox.offsetHeight;
      el.scenarioAvatarBox.classList.add('pop');
    }
  }

  function renderQuestion() {
    const q = state.questions[state.currentIdx];
    if (!q) return;
    el.qText.textContent = q.text || '';

    const prev = state.answers[state.currentIdx];

    el.optionsList.innerHTML = '';
    (q.options || []).forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'option';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.dataset.letter = opt.letter;
      if (prev && prev.letter === opt.letter) li.classList.add('selected');
      li.innerHTML =
        '<span class="option-bullet" aria-hidden="true">' + String.fromCharCode(65 + i) + '</span>' +
        '<span class="option-label"></span>';
      li.querySelector('.option-label').textContent = opt.label;

      const handler = function (e) {
        if (e.type === 'keydown') {
          if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
          e.preventDefault();
        }
        onSelectOption(li, opt);
      };
      li.addEventListener('click', handler);
      li.addEventListener('keydown', handler);

      el.optionsList.appendChild(li);
    });
  }

  function onSelectOption(node, opt) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    [...el.optionsList.children].forEach((c) => {
      c.classList.remove('selected', 'flashing');
    });
    node.classList.add('flashing');

    const q = state.questions[state.currentIdx];
    state.answers[state.currentIdx] = {
      id: q.id,
      dim: q.dim,
      weight: q.weight,
      letter: opt.letter
    };

    setTimeout(function () {
      node.classList.remove('flashing');
      node.classList.add('selected');

      setTimeout(function () {
        if (state.currentIdx < state.questions.length - 1) {
          animateTo(+1);
        } else {
          state.isAnimating = false;
          computeResult();
        }
      }, NEXT_DELAY);
    }, FLASH_MS);
  }

  function previousQuestion() {
    if (state.isAnimating || state.currentIdx === 0) return;
    animateTo(-1);
  }
  function nextQuestion() {
    if (state.isAnimating) return;
    if (!state.answers[state.currentIdx]) return;
    if (state.currentIdx < state.questions.length - 1) {
      animateTo(+1);
    } else {
      computeResult();
    }
  }

  function animateTo(direction) {
    state.isAnimating = true;
    const card = el.quizCard;
    const outX = direction === 1 ? -28 : 28;
    const inX  = direction === 1 ? 28 : -28;

    card.style.transition = 'transform 0.26s cubic-bezier(0.16,1,0.3,1), opacity 0.26s ease';
    card.style.transform  = 'translateX(' + outX + 'px)';
    card.style.opacity    = '0';

    setTimeout(function () {
      state.currentIdx += direction;

      card.style.transition = 'none';
      card.style.transform  = 'translateX(' + inX + 'px)';
      card.style.opacity    = '0';

      renderQuiz();

      // eslint-disable-next-line no-unused-expressions
      card.offsetHeight;

      card.style.transition = 'transform 0.26s cubic-bezier(0.16,1,0.3,1), opacity 0.26s ease';
      card.style.transform  = 'translateX(0)';
      card.style.opacity    = '1';

      setTimeout(function () {
        state.isAnimating = false;
        card.style.transition = '';
        card.style.transform  = '';
        card.style.opacity    = '';
      }, ANIM_MS + 40);
    }, ANIM_MS);
  }

  function updateNavButtons() {
    el.btnPrev.disabled = state.currentIdx === 0;
    const hasAnswer = !!state.answers[state.currentIdx];
    const isLast = state.currentIdx === state.questions.length - 1;
    el.btnNext.disabled = !hasAnswer;
    const nextLabel = el.btnNext.querySelector('span');
    if (nextLabel) nextLabel.textContent = isLast ? '看结果' : '下一题';
  }

  // ------------------------------------------------------------
  // 内联匹配算法 — 与 lib/classifier.js 等价
  // ------------------------------------------------------------
  function classifyAnswers(answers, foods) {
    const score = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    for (const a of answers) {
      if (a && a.letter) score[a.letter] += a.weight;
    }
    const letters = DIMS.map((d) => {
      const [p, q] = POLES[d];
      return score[p] > score[q] ? p : q;
    });
    const mbti = letters.join('');
    const food = foods.find((f) => f.mbti === mbti);
    const confidences = {};
    for (const d of DIMS) {
      const [p, q] = POLES[d];
      confidences[d] = Math.abs(score[p] - score[q]) / 5;
    }
    return { mbti: mbti, food: food, confidences: confidences, score: score };
  }

  // ------------------------------------------------------------
  // RESULT
  // ------------------------------------------------------------
  function computeResult() {
    state.result = classifyAnswers(state.answers, state.foods);
    state.isAnimating = false;
    state.view = 'result';
    render();
  }

  function renderResult() {
    const result = state.result;
    if (!result || !result.food) return;
    const food = result.food;

    // 隐藏款 random pick — HIDDEN_PROB 概率切换图+名
    let displayName  = food.name_zh || '';
    let displayImage = food.image || '';
    let isHidden = false;
    if (food.hidden && Math.random() < HIDDEN_PROB) {
      displayName  = food.hidden.name_zh || displayName;
      displayImage = food.hidden.image || displayImage;
      isHidden = true;
    }

    el.resultImage.src = displayImage;
    el.resultImage.alt = displayName;
    if (el.hiddenBadge) el.hiddenBadge.hidden = !isHidden;

    el.resultNameTitle.textContent = food.title ? food.title + ' ' : '';
    el.resultName.textContent      = displayName;

    el.resultQuote.textContent = food.tagline || food.monologue || '';
    el.resultQuickReview.textContent = food.quick_review || '';
    el.resultInterpretation.textContent = food.interpretation || '';

    el.resultTags.innerHTML = '';
    (food.flavor_keywords || []).slice(0, 3).forEach((t) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = '#' + t;
      el.resultTags.appendChild(span);
    });

    el.resultCatchphrases.innerHTML = '';
    (food.alternates || []).forEach((alt) => {
      const d = document.createElement('div');
      d.className = 'catchphrase';
      d.textContent = alt;
      el.resultCatchphrases.appendChild(d);
    });

    // 副指数:外放度(E 分数)+ 感性度(F 分数)
    const externPct = Math.round(((result.score.E || 0) / 5) * 100);
    const senseFPct = Math.round(((result.score.F || 0) / 5) * 100);
    el.resultMdValue.textContent = externPct + '%';
    el.resultMdNote.textContent  = externNoteFor(externPct);
    el.resultNzValue.textContent = senseFPct + '%';
    el.resultNzNote.textContent  = senseNoteFor(senseFPct);

    // 搭子图谱(契合 / 互补 / 解压)
    renderFriendships(food);

    // 典型场景
    el.resultScene.textContent = food.scene || '';

    // 雷达
    drawRadar(el.radarCanvas, food.taste_signature || {});

    el.btnShare.classList.remove('is-copied');
    el.btnShare.textContent = '复制分享链接';
  }

  // ------------------------------------------------------------
  // Friendships(搭子图谱)— 内联 SVG 图标(不用 emoji)
  // 4 种类型,各对应一个 stroke 风简笔图标 + 一种 accent 色
  // ------------------------------------------------------------
  const ICON_NOTE  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  const ICON_HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const ICON_BRIEF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
  const ICON_SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/><circle cx="12" cy="12" r="2.5"/></svg>';

  // 类型 → 图标 + 卡片色调
  const FRIENDSHIP_THEME = {
    '灵魂知己':       { icon: ICON_NOTE,  accent: 'a' },  // 粉深
    '天下第一坠坠好': { icon: ICON_HEART, accent: 'c' },  // 浅粉
    '绝佳拍档':       { icon: ICON_BRIEF, accent: 'b' },  // 黄
    '欢喜冤家':       { icon: ICON_SPARK, accent: 'd' }   // 薄荷绿
  };

  function renderFriendships(food) {
    if (!el.friendshipCards) return;
    const list = (food.friendships || []).slice(0, 3);
    el.friendshipCards.innerHTML = list
      .map((fr) => {
        const partner = state.foods.find((x) => x.name_zh === fr.food);
        const partnerImg = partner ? partner.image : '';
        const partnerSubtitle = partner ? (partner.subtitle || '') : '';
        const theme = FRIENDSHIP_THEME[fr.type] || { icon: ICON_HEART, accent: 'a' };
        return (
          '<div class="friendship-card friendship-accent-' + theme.accent + '">' +
            '<div class="friendship-card-head">' +
              '<span class="friendship-card-icon">' + theme.icon + '</span>' +
              '<span class="friendship-card-type">' + fr.type + '</span>' +
            '</div>' +
            '<div class="friendship-card-partner">' +
              (partnerImg
                ? '<img class="friendship-card-img" src="' + partnerImg + '" alt="">'
                : '<div class="friendship-card-img friendship-card-img-empty">·</div>') +
              '<div class="friendship-card-partner-text">' +
                '<div class="friendship-card-name">' + (fr.food || '') + '</div>' +
                '<div class="friendship-card-sub">' + partnerSubtitle + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="friendship-card-why">' + (fr.why || '') + '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  // ------------------------------------------------------------
  // 雷达图(6 轴味道画像)
  // ------------------------------------------------------------
  function drawRadar(canvas, taste) {
    if (!canvas || !canvas.getContext) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalSize = 320;
    canvas.width  = logicalSize * dpr;
    canvas.height = logicalSize * dpr;
    canvas.style.width  = logicalSize + 'px';
    canvas.style.height = logicalSize + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalSize, logicalSize);

    const cx = logicalSize / 2;
    const cy = logicalSize / 2;
    const r  = Math.min(cx, cy) - 56;
    const axisCount = TASTE_LABELS.length;

    const norm = TASTE_LABELS.map((k) => Math.max(0, Math.min(1, (taste[k] || 0) / 9)));

    const angleFor = (i) => (-Math.PI / 2) + (i * 2 * Math.PI / axisCount);

    ctx.strokeStyle = '#F0CCDA';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach((scale) => {
      ctx.beginPath();
      for (let i = 0; i < axisCount; i++) {
        const a = angleFor(i);
        const x = cx + Math.cos(a) * r * scale;
        const y = cy + Math.sin(a) * r * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    });

    ctx.strokeStyle = '#F0CCDA';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 107, 149, 0.22)';
    ctx.strokeStyle = '#FF6B95';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const x = cx + Math.cos(a) * r * norm[i];
      const y = cy + Math.sin(a) * r * norm[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FF6B95';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const x = cx + Math.cos(a) * r * norm[i];
      const y = cy + Math.sin(a) * r * norm[i];
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#111';
    ctx.font = '600 14px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const labelDist = r + 26;
      const lx = cx + Math.cos(a) * labelDist;
      const ly = cy + Math.sin(a) * labelDist;
      ctx.fillStyle = '#111';
      ctx.fillText(TASTE_LABELS[i].replace('度', ''), lx, ly - 8);

      ctx.fillStyle = '#8A8A8A';
      ctx.font = '400 12px -apple-system, sans-serif';
      ctx.fillText(Math.round(norm[i] * 9) + '/9', lx, ly + 8);
      ctx.font = '600 14px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
    }
  }

  // ------------------------------------------------------------
  // Highlight card 文案
  // ------------------------------------------------------------
  function externNoteFor(pct) {
    if (pct >= 80) return '人群是你的电池 · 一个人会没电';
    if (pct >= 60) return '需要被看见,但能挑场合';
    if (pct >= 40) return '可热可冷 · 看心情和搭子';
    if (pct >= 20) return '更喜欢自己消化,情绪不外露';
    return '内化派 · 一个人才完整';
  }
  function senseNoteFor(pct) {
    if (pct >= 80) return '心动一秒就忘了原本要决策什么';
    if (pct >= 60) return '感受先到,理性追赶半拍';
    if (pct >= 40) return '可感性可理性 · 看场景';
    if (pct >= 20) return '决策先理性,允许情绪发声';
    return '冷静派 · 数据和逻辑先排队';
  }

  // ------------------------------------------------------------
  // Share / Restart
  // ------------------------------------------------------------
  async function shareLink() {
    const url = location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        legacyCopy(url);
      }
      showCopied();
    } catch (err) {
      try { legacyCopy(url); showCopied(); }
      catch (_) { el.btnShare.textContent = '复制失败 · 请手动复制'; }
    }
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  function showCopied() {
    el.btnShare.classList.add('is-copied');
    el.btnShare.textContent = '已复制 ✓';
    clearTimeout(showCopied._t);
    showCopied._t = setTimeout(() => {
      el.btnShare.classList.remove('is-copied');
      el.btnShare.textContent = '复制分享链接';
    }, 2000);
  }

  function restart() {
    state.view = 'intro';
    state.currentIdx = 0;
    state.answers = [];
    state.result = null;
    state.isAnimating = false;
    render();
  }

  // ------------------------------------------------------------
  // 长截图保存(html2canvas pipeline,沿用 petti)
  // 1) 优先 Web Share API(iOS 15+, Android Chrome) → 原生保存面板
  // 2) Android/Desktop:blob download
  // 3) iOS 兜底:打开模态框,长按图片保存
  // ------------------------------------------------------------
  const CAPTURE_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  let _captureLibLoading = null;
  function ensureCaptureLib() {
    if (window.html2canvas) return Promise.resolve();
    if (_captureLibLoading) return _captureLibLoading;
    _captureLibLoading = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = CAPTURE_CDN;
      s.onload = function () { resolve(); };
      s.onerror = function () { _captureLibLoading = null; reject(new Error('html2canvas load failed')); };
      document.head.appendChild(s);
    });
    return _captureLibLoading;
  }

  async function embedImagesAsDataUrl(root) {
    const imgs = root.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(async function (img) {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        const abs = new URL(src, location.href).href;
        const res = await fetch(abs, { cache: 'force-cache' });
        const blob = await res.blob();
        const dataUrl = await new Promise(function (resolve, reject) {
          const r = new FileReader();
          r.onloadend = function () { resolve(r.result); };
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        img.src = dataUrl;
        if (typeof img.decode === 'function') { try { await img.decode(); } catch (_) {} }
      } catch (e) {
        console.warn('[FoodTI] embed img fail, keep original', src, e);
      }
    }));
  }

  function snapshotCanvases(root) {
    const swaps = [];
    root.querySelectorAll('canvas').forEach(function (canvas) {
      try {
        if (!canvas.width || !canvas.height) return;
        const dataUrl = canvas.toDataURL('image/png');
        const img = new Image();
        img.src = dataUrl;
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        const cs = window.getComputedStyle(canvas);
        img.style.width = cs.width;
        img.style.height = cs.height;
        img.style.display = cs.display === 'inline' ? 'inline-block' : (cs.display || 'block');
        img.style.verticalAlign = 'middle';
        const parent = canvas.parentNode;
        const next = canvas.nextSibling;
        parent.replaceChild(img, canvas);
        swaps.push({ canvas: canvas, img: img, parent: parent, next: next });
      } catch (e) {
        console.warn('[FoodTI] canvas snapshot failed', e);
      }
    });
    return function restore() {
      swaps.forEach(function (s) {
        if (!s.img.parentNode) return;
        if (s.next && s.next.parentNode === s.parent) {
          s.parent.insertBefore(s.canvas, s.next);
        } else {
          s.parent.appendChild(s.canvas);
        }
        s.img.remove();
      });
    };
  }

  async function waitAllImagesReady(root) {
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(function (img) {
      const settled = (img.complete && img.naturalWidth > 0)
        ? Promise.resolve()
        : new Promise(function (resolve) {
            const done = function () {
              img.removeEventListener('load', done);
              img.removeEventListener('error', done);
              resolve();
            };
            img.addEventListener('load', done);
            img.addEventListener('error', done);
            setTimeout(done, 2000);
          });
      return settled.then(function () {
        if (typeof img.decode === 'function') {
          return img.decode().catch(function () {});
        }
      });
    }));
  }

  function showSaveLoading(show) {
    if (!el.saveLoading) return;
    el.saveLoading.classList.toggle('visible', !!show);
  }
  function openSaveModal(dataUrl) {
    if (!el.saveModal || !el.saveModalImg) return;
    el.saveModalImg.src = dataUrl;
    el.saveModal.classList.add('visible');
    el.saveModal.setAttribute('aria-hidden', 'false');
  }
  function closeSaveModal() {
    if (!el.saveModal) return;
    el.saveModal.classList.remove('visible');
    el.saveModal.setAttribute('aria-hidden', 'true');
    if (el.saveModalImg) el.saveModalImg.src = '';
  }

  async function saveLongScreenshot() {
    const food = state.result && state.result.food;
    if (!food || !el.viewResult) return;
    if (el.btnSaveLong.disabled) return;

    const originalLabel = el.btnSaveLong.innerHTML;
    el.btnSaveLong.disabled = true;
    el.btnSaveLong.textContent = '生成中…';
    showSaveLoading(true);

    el.viewResult.classList.add('result-capturing');

    let restoreCanvases = function () {};
    try {
      await ensureCaptureLib();
      await embedImagesAsDataUrl(el.viewResult);
      restoreCanvases = snapshotCanvases(el.viewResult);
      await waitAllImagesReady(el.viewResult);
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });

      const scale = (window.devicePixelRatio && window.devicePixelRatio > 1) ? 2 : 1;
      const canvas = await window.html2canvas(el.viewResult, {
        backgroundColor: '#FFFFFF',
        scale: scale,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        logging: false,
        imageTimeout: 8000,
        removeContainer: true
      });
      const blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('canvas.toBlob returned null'));
        }, 'image/png');
      });
      if (!blob) throw new Error('canvas toBlob returned null');

      const filename = 'foodti-' + food.id + '-' + Date.now() + '.png';
      const file = new File([blob], filename, { type: 'image/png' });

      let shared = false;
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'FoodTI · 食格测试',
            text: '我的本命食物是: ' + (food.title || '') + ' ' + (food.name_zh || '')
          });
          shared = true;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') { shared = true; }
        else console.warn('[FoodTI] share API failed, falling back', e);
      }

      if (!shared) {
        const ua = (navigator.userAgent || '').toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const dataUrl = await new Promise(function (resolve, reject) {
          const r = new FileReader();
          r.onloadend = function () { resolve(r.result); };
          r.onerror = reject;
          r.readAsDataURL(blob);
        });

        if (isIOS) {
          openSaveModal(dataUrl);
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        }
      }
    } catch (err) {
      console.error('[FoodTI] long screenshot failed', err);
      alert('截图生成失败,请稍后重试~');
    } finally {
      try { restoreCanvases(); } catch (_) {}
      el.viewResult.classList.remove('result-capturing');
      showSaveLoading(false);
      el.btnSaveLong.disabled = false;
      el.btnSaveLong.innerHTML = originalLabel;
    }
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
