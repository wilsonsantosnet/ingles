// ============================================
// TEXT-TO-SPEECH (TTS)
// ============================================

const TTS = {
  speaking: false,
  queue: [],
  currentUtterance: null,

  /** Fala um texto individual */
  speak(text, lang = 'en-US', rate = 0.9) {
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.onend = () => { this.speaking = false; this._updateButtons(); };
    utterance.onerror = () => { this.speaking = false; this._updateButtons(); };
    this.speaking = true;
    this.currentUtterance = utterance;
    speechSynthesis.speak(utterance);
    this._updateButtons();
  },

  /** Fala uma lista de textos em sequência */
  speakList(texts, lang = 'en-US', rate = 0.9) {
    this.stop();
    this.queue = [...texts];
    this.speaking = true;
    this._updateButtons();
    this._speakNext(lang, rate);
  },

  _speakNext(lang, rate) {
    if (this.queue.length === 0) {
      this.speaking = false;
      this._updateButtons();
      return;
    }
    const text = this.queue.shift();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.onend = () => {
      // Pequena pausa entre itens
      setTimeout(() => this._speakNext(lang, rate), 400);
    };
    utterance.onerror = () => {
      this.speaking = false;
      this.queue = [];
      this._updateButtons();
    };
    this.currentUtterance = utterance;
    speechSynthesis.speak(utterance);
  },

  /** Para a fala atual */
  stop() {
    speechSynthesis.cancel();
    this.queue = [];
    this.speaking = false;
    this.currentUtterance = null;
    this._updateButtons();
  },

  /** Atualiza visual dos botões */
  _updateButtons() {
    document.querySelectorAll('.tts-btn').forEach(btn => {
      btn.classList.toggle('tts-playing', false);
    });
  }
};

/** Retorna lang e rate da categoria atual */
function getTTSConfig() {
  return {
    lang: currentCategory?.ttsLang || 'en-US',
    rate: currentCategory?.ttsRate || 0.9
  };
}

/** Fala um texto individual (chamado pelos botões inline) */
function ttsSpeak(text, lang) {
  if (TTS.speaking) {
    TTS.stop();
  } else {
    const cfg = getTTSConfig();
    TTS.speak(text, lang || cfg.lang, cfg.rate);
  }
}

/** Fala todos os itens de uma seção */
function ttsSpeakSection(sectionId) {
  if (TTS.speaking) {
    TTS.stop();
    return;
  }
  const section = document.getElementById(sectionId);
  if (!section) return;
  const items = section.querySelectorAll('[data-tts-text]');
  const texts = Array.from(items).map(el => el.getAttribute('data-tts-text')).filter(Boolean);
  if (texts.length > 0) {
    const cfg = getTTSConfig();
    TTS.speakList(texts, cfg.lang, cfg.rate);
  }
}

/** Fala o texto visível de um elemento DOM pelo ID */
function ttsReadElement(elementId) {
  if (TTS.speaking) {
    TTS.stop();
    return;
  }
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.innerText || el.textContent || '';
  if (text.trim()) {
    const cfg = getTTSConfig();
    TTS.speak(text.trim(), cfg.lang, cfg.rate);
  }
}

// Expor globalmente
window.ttsSpeak = ttsSpeak;
window.ttsSpeakSection = ttsSpeakSection;
window.ttsReadElement = ttsReadElement;
window.TTS = TTS;

// Estado da aplicação
let currentCategory = null;
let categoryAdapter = null;
let currentItems = [];
let currentIndex = 0;
let stats = {};
let categories = [];
let currentTips = [];

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isManager = urlParams.has('manager');
  
  if (isManager) {
    // Modo manager: mostrar tela de seleção de categorias
    loadCategories();
  } else {
    // Modo padrão: ir direto para inglês
    loadCategoriesAndAutoSelect();
  }
  setupEventListeners();
});

// ============================================
// CATEGORIAS
// ============================================

async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    const data = await response.json();
    categories = data.categories;
    displayCategories();
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
    document.getElementById('categories-list').innerHTML = 
      '<p class="error">Erro ao carregar categorias.</p>';
  }
}

async function loadCategoriesAndAutoSelect() {
  try {
    const response = await fetch('/api/categories');
    const data = await response.json();
    categories = data.categories;
    await selectCategory('ingles');
  } catch (error) {
    console.error('Erro ao carregar categoria:', error);
    // Fallback: mostrar seletor
    loadCategories();
  }
}

function displayCategories() {
  const container = document.getElementById('categories-list');
  
  if (!categories || categories.length === 0) {
    container.innerHTML = `
      <p class="loading">Nenhuma categoria disponível.</p>
      <p class="hint">Execute: npm run categories:create -- --id "id" --name "Nome"</p>
    `;
    return;
  }
  
  container.innerHTML = categories.map(cat => `
    <div class="category-card">
      <div onclick="selectCategory('${cat.id}')" style="cursor: pointer;">
        <div class="category-icon">${cat.icon}</div>
        <h3>${cat.name}</h3>
        <p>${cat.description}</p>
      </div>
      <button class="btn btn-secondary" onclick="event.stopPropagation(); window.location.href='/manage.html?category=${cat.id}'" style="width: 100%; margin-top: 10px;">
        🛠️ Gerenciar Aulas
      </button>
      ${cat.id === 'anki' ? `
        <button class="btn btn-primary" onclick="event.stopPropagation(); window.location.href='/anki.html'" style="width: 100%; margin-top: 10px;">
          ⚡ Anki Rápido
        </button>
      ` : ''}
    </div>
  `).join('');
}

async function selectCategory(categoryId) {
  currentCategory = categories.find(c => c.id === categoryId);
  
  // Criar adaptador para essa categoria
  categoryAdapter = new CategoryAdapter(currentCategory);
  
  // Esconder seletor de categorias
  document.getElementById('category-section').style.display = 'none';
  
  // Mostrar seções de estudo
  document.getElementById('stats-section').style.display = 'block';
  document.getElementById('study-section').style.display = 'block';
  document.getElementById('lessons-section').style.display = 'block';
  
  // Carregar dados da categoria
  await loadCategoryTips(categoryId);
  await loadStats(categoryId);
  await loadLessons(categoryId);
  await loadStudySession(categoryId);
}

function changeCategory() {
  currentCategory = null;
  categoryAdapter = null;
  currentItems = [];
  currentIndex = 0;
  currentTips = [];
  closeTipsPanel();
  updateTipsButton();
  
  // Mostrar seletor
  document.getElementById('category-section').style.display = 'block';
  
  // Esconder seções
  document.getElementById('stats-section').style.display = 'none';
  document.getElementById('study-section').style.display = 'none';
  document.getElementById('lessons-section').style.display = 'none';
}

// Tornar funções globais
window.selectCategory = selectCategory;
window.changeCategory = changeCategory;

// ============================================
// CARREGAR DADOS
// ============================================

async function loadStats(categoryId) {
  try {
    const response = await fetch(`/api/categories/${categoryId}/stats`);
    stats = await response.json();
    updateStatsUI();
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
}

async function loadLessons(categoryId) {
  try {
    const response = await fetch(`/api/categories/${categoryId}/lessons`);
    const lessons = await response.json();
    displayLessons(lessons, categoryId);
  } catch (error) {
    console.error('Erro ao carregar aulas:', error);
    document.getElementById('lessons-list').innerHTML = 
      '<p class="loading">Nenhuma aula processada. Execute o processamento primeiro.</p>';
  }
}

async function loadStudySession(categoryId) {
  try {
    const response = await fetch(`/api/categories/${categoryId}/study/today`);
    const data = await response.json();
    
    currentItems = data.items;
    currentIndex = 0;
    
    if (currentItems.length === 0) {
      document.getElementById('no-items').style.display = 'block';
      document.getElementById('study-area').style.display = 'none';
    } else {
      document.getElementById('no-items').style.display = 'none';
      document.getElementById('study-area').style.display = 'block';
      showCurrentCard();
    }

    const studyHeader = document.getElementById('study-section-title');
    if (studyHeader) {
      studyHeader.textContent = '🎯 Revisão de Hoje';
    }
  } catch (error) {
    console.error('Erro ao carregar sessão de estudo:', error);
  }
}

async function loadCategoryTips(categoryId) {
  try {
    const response = await fetch(`/api/categories/${categoryId}/tips`);
    const data = await response.json();
    currentTips = normalizeTips(data.tips);
  } catch (error) {
    console.error('Erro ao carregar dicas da categoria:', error);
    currentTips = [];
  }

  updateTipsButton();
  renderTipsPanel();
}

// Carregar aula específica para prática (não baseada em SRS)
async function startLessonPractice(categoryId, lessonId) {
  try {
    const response = await fetch(`/api/categories/${categoryId}/lessons/${lessonId}/practice`);
    const data = await response.json();
    
    currentItems = data.items;
    currentIndex = 0;
    
    if (currentItems.length === 0) {
      alert('❌ Esta aula não possui itens para praticar ainda.');
      return;
    }
    
    // Rolar para área de estudo
    document.getElementById('study-section').scrollIntoView({ behavior: 'smooth' });
    
    // Mostrar área de estudo
    document.getElementById('no-items').style.display = 'none';
    document.getElementById('study-area').style.display = 'block';
    
    // Atualizar título da sessão
    const studyHeader = document.getElementById('study-section-title');
    if (studyHeader) {
      studyHeader.innerHTML = `🎯 Praticando: ${data.lessonTitle || lessonId}`;
    }

    showCurrentCard();
  } catch (error) {
    console.error('Erro ao carregar aula para prática:', error);
    alert('❌ Erro ao carregar exercícios da aula.');
  }
}

window.startLessonPractice = startLessonPractice;

// ============================================
// INTERFACE
// ============================================

function updateStatsUI() {
  document.getElementById('stat-due').textContent = (stats.dueToday || 0) + (stats.overdue || 0);
  document.getElementById('stat-total').textContent = stats.total || 0;
  document.getElementById('stat-mastered').textContent = stats.mastered || 0;
  document.getElementById('stat-reviews').textContent = stats.totalReviews || 0;
}

function displayLessons(lessons, categoryId) {
  const container = document.getElementById('lessons-list');
  
  if (!lessons || lessons.length === 0) {
    container.innerHTML = `<p class="loading">Nenhuma aula processada ainda.</p>
      <p class="hint">Execute: npm run process -- --category=${categoryId}</p>`;
    return;
  }
  
  container.innerHTML = lessons
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(lesson => `
      <div class="lesson-item">
        <div class="lesson-header">
          <div>
            <h3>📖 ${formatDate(lesson.date)} · ${lesson.title || 'Aula sem título'}</h3>
            <p class="lesson-meta">📄 ${lesson.file} • ${lesson.status === 'enriched' ? '✅ Enriquecida' : '❌ Erro'}</p>
          </div>
          <button class="btn-expand" onclick="toggleLesson('${lesson.id}', '${categoryId}')">
            <span id="icon-${lesson.id}">▼</span> Ver Detalhes
          </button>
        </div>
        <div id="details-${lesson.id}" class="lesson-details" style="display: none;">
          <div class="loading">Carregando conteúdo...</div>
        </div>
      </div>
    `).join('');
}

async function toggleLesson(lessonId, categoryId) {
  const detailsEl = document.getElementById(`details-${lessonId}`);
  const iconEl = document.getElementById(`icon-${lessonId}`);
  
  if (detailsEl.style.display === 'none') {
    detailsEl.style.display = 'block';
    iconEl.textContent = '▲';
    
    if (detailsEl.innerHTML.includes('Carregando')) {
      try {
        const response = await fetch(`/api/categories/${categoryId}/lessons/${lessonId}`);
        const lesson = await response.json();
        
        // Garantir que categoryId está disponível para o botão de prática
        if (!lesson.categoryId) {
          lesson.categoryId = categoryId;
        }
        
        detailsEl.innerHTML = formatLessonDetails(lesson);
      } catch (error) {
        detailsEl.innerHTML = '<p class="error">Erro ao carregar detalhes da aula.</p>';
      }
    }
  } else {
    detailsEl.style.display = 'none';
    iconEl.textContent = '▼';
  }
}

window.toggleLesson = toggleLesson;

function formatLessonDetails(lesson) {
  // Usar o adaptador se disponível
  if (categoryAdapter) {
    return categoryAdapter.formatLessonDetails(lesson);
  }
  
  // Fallback para formato antigo
  const enriched = lesson.enriched;
  
  if (!enriched) {
    return '<p class="error">Aula não foi enriquecida ainda.</p>';
  }
  
  let html = `
    <div class="lesson-section">
      <h4>📝 Resumo</h4>
      <p>${enriched.summary || 'Não disponível'}</p>
    </div>
  `;
  
  if (enriched.mainTopics && enriched.mainTopics.length > 0) {
    html += `
      <div class="lesson-section">
        <h4>🎯 Tópicos Principais</h4>
        <ul class="topics-list">
          ${enriched.mainTopics.map(topic => `<li>${topic}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  if (enriched.vocabulary && enriched.vocabulary.length > 0) {
    html += `
      <div class="lesson-section">
        <h4>📚 Vocabulário (${enriched.vocabulary.length} palavras)</h4>
        <div class="vocab-grid">
          ${enriched.vocabulary.slice(0, 10).map(item => `
            <div class="vocab-card-mini">
              <strong>${item.word}</strong>
              <span class="translation">${item.translation || '—'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  return html;
}

function showCurrentCard() {
  if (currentIndex >= currentItems.length) {
    finishStudySession();
    return;
  }

  const item = currentItems[currentIndex];
  
  // Atualizar progresso
  const progress = ((currentIndex / currentItems.length) * 100).toFixed(0);
  document.getElementById('progress-fill').style.width = `${progress}%`;
  document.getElementById('progress-text').textContent = `${currentIndex} / ${currentItems.length}`;
  
  // Atualizar cabeçalho
  document.getElementById('card-category').textContent = getCategoryLabel(item.category);
  document.getElementById('card-lesson').textContent = `Aula: ${formatDate(item.lessonDate)}`;
  
  // Atualizar conteúdo usando adaptador
  const questionEl = document.getElementById('card-question');
  const answerEl = document.getElementById('card-answer');
  
  if (categoryAdapter) {
    const formatted = categoryAdapter.formatStudyCard(item);
    questionEl.innerHTML = formatted.question;
    answerEl.innerHTML = formatted.answer;
    
    // Limpar campos de resposta do usuário (se existirem)
    setTimeout(() => {
      const userInputs = document.querySelectorAll('.user-answer-input');
      userInputs.forEach(input => input.value = '');
    }, 0);
  } else {
    // Fallback para lógica antiga
    if (item.category === 'vocabulary') {
      questionEl.innerHTML = `<h3>${item.word}</h3>`;
      answerEl.innerHTML = `
        <p><strong>Tradução:</strong> ${item.translation || 'N/A'}</p>
        <p><strong>Definição:</strong> ${item.definition || 'N/A'}</p>
      `;
    } else if (item.category === 'question') {
      questionEl.innerHTML = `<p>${item.question}</p>`;
      answerEl.innerHTML = `<p><strong>Resposta:</strong> ${item.answer || item.explanation || 'N/A'}</p>`;
    } else {
      questionEl.innerHTML = `<p>${item.topic || item.question || item.word}</p>`;
      answerEl.innerHTML = `<p>${item.explanation || item.answer || item.definition || 'N/A'}</p>`;
    }
  }
  
  // Resetar botões
  document.getElementById('show-answer-btn').style.display = 'block';
  document.getElementById('rating-buttons').style.display = 'none';
  answerEl.style.display = 'none';
  updateTipsButton();
}

async function submitRating(quality) {
  const item = currentItems[currentIndex];
  
  try {
    await fetch(`/api/categories/${currentCategory.id}/study/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: item.id,
        lessonId: item.lessonId,
        quality: parseInt(quality)
      })
    });
    
    currentIndex++;
    showCurrentCard();
  } catch (error) {
    console.error('Erro ao registrar revisão:', error);
    alert('Erro ao salvar resposta. Tente novamente.');
  }
}

function finishStudySession() {
  document.getElementById('study-area').style.display = 'none';
  document.getElementById('no-items').style.display = 'block';
  document.getElementById('no-items').innerHTML = `
    <h3>🎉 Sessão Concluída!</h3>
    <p>Você revisou <strong>${currentItems.length}</strong> itens hoje.</p>
    <p>Continue assim e você dominará tudo em breve!</p>
  `;
  loadStats(currentCategory.id);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  document.getElementById('show-answer-btn')?.addEventListener('click', () => {
    document.getElementById('card-answer').style.display = 'block';
    document.getElementById('show-answer-btn').style.display = 'none';
    document.getElementById('rating-buttons').style.display = 'block';
  });

  document.getElementById('tips-toggle-btn')?.addEventListener('click', toggleTipsPanel);
  document.getElementById('tips-maximize-btn')?.addEventListener('click', toggleTipsMaximize);
  document.getElementById('tips-close-btn')?.addEventListener('click', closeTipsPanel);
  document.getElementById('tips-panel-backdrop')?.addEventListener('click', closeTipsPanel);
  document.getElementById('back-to-manager-top-btn')?.addEventListener('click', () => {
    window.location.href = '/?manager';
  });
  
  document.querySelectorAll('.btn-rating').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const quality = e.currentTarget.dataset.quality;
      submitRating(quality);
    });
  });
}

// ============================================
// UTILIDADES
// ============================================

function getCategoryLabel(category) {
  const labels = {
    'vocabulary': '📚 Vocabulário',
    'question': '❓ Questão',
    'grammar': '✏️ Gramática'
  };
  return labels[category] || '📖 Conteúdo';
}

function formatDate(dateString) {
  // Evita deslocamento de fuso: strings YYYY-MM-DD devem ser tratadas como data local.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

function normalizeTips(tips) {
  if (!tips || typeof tips !== 'object' || Array.isArray(tips)) {
    return [];
  }

  return Object.entries(tips).map(([title, content], index) => ({
    id: `tip-${index + 1}`,
    title,
    content: typeof content === 'string' ? content : ''
  })).filter(tip => tip.title && tip.content);
}

function updateTipsButton() {
  const tipsButton = document.getElementById('tips-toggle-btn');
  if (!tipsButton) {
    return;
  }

  const hasStudyItems = currentItems.length > 0 && currentIndex < currentItems.length;
  const hasTips = currentTips.length > 0;
  tipsButton.style.display = hasStudyItems && hasTips ? 'inline-flex' : 'none';

  if (!hasStudyItems || !hasTips) {
    closeTipsPanel();
  }
}

function renderTipsPanel() {
  const titleEl = document.getElementById('tips-panel-title');
  const contentEl = document.getElementById('tips-panel-content');

  if (!titleEl || !contentEl) {
    return;
  }

  titleEl.textContent = currentCategory ? `Dicas de ${currentCategory.name}` : 'Dicas de estudo';

  if (currentTips.length === 0) {
    contentEl.innerHTML = '<p class="tips-empty">Nenhuma dica cadastrada para esta categoria.</p>';
    return;
  }

  contentEl.innerHTML = currentTips.map((tip, index) => `
    <article class="tip-card tip-accordion-item ${index === 0 ? 'expanded' : ''}">
      <button class="tip-accordion-trigger" type="button" data-tip-id="${tip.id}" aria-expanded="${index === 0 ? 'true' : 'false'}">
        <span class="tip-accordion-title">${escapeHtml(tip.title)}</span>
        <span class="tip-accordion-icon">▾</span>
      </button>
      <div class="tip-card-body" data-tip-panel="${tip.id}" style="display: ${index === 0 ? 'block' : 'none'};">${renderTipContent(tip.content)}</div>
    </article>
  `).join('');

  contentEl.querySelectorAll('.tip-accordion-trigger').forEach(button => {
    button.addEventListener('click', () => toggleTipAccordion(button.dataset.tipId));
  });
}

function toggleTipsPanel() {
  const panel = document.getElementById('tips-panel');
  if (!panel || currentTips.length === 0) {
    return;
  }

  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    closeTipsPanel();
    return;
  }

  renderTipsPanel();
  updateTipsMaximizeButton();
  panel.style.display = 'flex';
  document.getElementById('tips-panel-backdrop').style.display = 'block';
  requestAnimationFrame(() => {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  });
}

function closeTipsPanel() {
  const panel = document.getElementById('tips-panel');
  const backdrop = document.getElementById('tips-panel-backdrop');
  if (!panel || !backdrop) {
    return;
  }

  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  backdrop.style.display = 'none';
  panel.style.display = 'none';
}

function toggleTipsMaximize() {
  const panel = document.getElementById('tips-panel');
  if (!panel) {
    return;
  }

  panel.classList.toggle('maximized');
  updateTipsMaximizeButton();
}

function updateTipsMaximizeButton() {
  const panel = document.getElementById('tips-panel');
  const maximizeBtn = document.getElementById('tips-maximize-btn');
  if (!panel || !maximizeBtn) {
    return;
  }

  const isMaximized = panel.classList.contains('maximized');
  maximizeBtn.textContent = isMaximized ? '🗗' : '⛶';
  maximizeBtn.title = isMaximized ? 'Restaurar tamanho original' : 'Maximizar dicas';
  maximizeBtn.setAttribute('aria-label', maximizeBtn.title);
}

function toggleTipAccordion(tipId) {
  const container = document.getElementById('tips-panel-content');
  if (!container) {
    return;
  }

  container.querySelectorAll('.tip-accordion-trigger').forEach(trigger => {
    const isCurrent = trigger.dataset.tipId === tipId;
    const panel = container.querySelector(`[data-tip-panel="${trigger.dataset.tipId}"]`);
    const card = trigger.closest('.tip-accordion-item');
    const shouldOpen = isCurrent ? trigger.getAttribute('aria-expanded') !== 'true' : false;

    trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');

    if (panel) {
      panel.style.display = shouldOpen ? 'block' : 'none';
    }

    if (card) {
      card.classList.toggle('expanded', shouldOpen);
    }
  });
}

function renderTipContent(content) {
  if (isLikelyHtml(content)) {
    return wrapTablesForScroll(content);
  }

  return wrapTablesForScroll(markdownToHtml(content));
}

function isLikelyHtml(content) {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function wrapTablesForScroll(content) {
  return String(content || '')
    .replace(/<table/gi, '<div class="tip-table-scroll"><table')
    .replace(/<\/table>/gi, '</table></div>');
}

function markdownToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const html = [];
  let paragraphLines = [];
  let listType = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    html.push(`<p>${renderInlineMarkdown(paragraphLines.join('<br>'))}</p>`);
    paragraphLines = [];
  };

  const closeList = () => {
    if (!listType) {
      return;
    }

    html.push(listType === 'ol' ? '</ol>' : '</ul>');
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      html.push(`<h${level + 3}>${renderInlineMarkdown(headingMatch[2])}</h${level + 3}>`);
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    closeList();
    paragraphLines.push(escapeHtml(line));
  }

  flushParagraph();
  closeList();

  return html.join('');
}

function renderInlineMarkdown(text) {
  return String(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
