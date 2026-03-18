// Estado da aplicação
let currentItems = [];
let currentIndex = 0;
let stats = {};

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadLessons();
  loadStudySession();
  setupEventListeners();
});

// ============================================
// CARREGAR DADOS
// ============================================

async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    stats = await response.json();
    updateStatsUI();
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
}

async function loadLessons() {
  try {
    const response = await fetch('/api/lessons');
    const index = await response.json();
    displayLessons(index.lessons);
  } catch (error) {
    console.error('Erro ao carregar aulas:', error);
    document.getElementById('lessons-list').innerHTML = 
      '<p class="loading">Erro ao carregar aulas. Execute o processamento primeiro.</p>';
  }
}

async function loadStudySession() {
  try {
    const response = await fetch('/api/study/today');
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
  } catch (error) {
    console.error('Erro ao carregar sessão de estudo:', error);
  }
}

// ============================================
// INTERFACE
// ============================================

function updateStatsUI() {
  document.getElementById('stat-due').textContent = stats.dueToday + stats.overdue || 0;
  document.getElementById('stat-total').textContent = stats.total || 0;
  document.getElementById('stat-mastered').textContent = stats.mastered || 0;
  document.getElementById('stat-reviews').textContent = stats.totalReviews || 0;
}

function displayLessons(lessons) {
  const container = document.getElementById('lessons-list');
  
  if (!lessons || lessons.length === 0) {
    container.innerHTML = '<p class="loading">Nenhuma aula processada ainda.</p>';
    return;
  }
  
  container.innerHTML = lessons
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(lesson => `
      <div class="lesson-item">
        <div class="lesson-header">
          <div>
            <h3>📖 Aula de ${formatDate(lesson.date)}</h3>
            <p class="lesson-meta">📄 ${lesson.file} • ${lesson.status === 'enriched' ? '✅ Enriquecida' : '❌ Erro'}</p>
          </div>
          <button class="btn-expand" onclick="toggleLesson('${lesson.id}')">
            <span id="icon-${lesson.id}">▼</span> Ver Detalhes
          </button>
        </div>
        <div id="details-${lesson.id}" class="lesson-details" style="display: none;">
          <div class="loading">Carregando conteúdo...</div>
        </div>
      </div>
    `).join('');
}

async function toggleLesson(lessonId) {
  const detailsEl = document.getElementById(`details-${lessonId}`);
  const iconEl = document.getElementById(`icon-${lessonId}`);
  
  if (detailsEl.style.display === 'none') {
    // Expandir
    detailsEl.style.display = 'block';
    iconEl.textContent = '▲';
    
    // Carregar detalhes se ainda não foi carregado
    if (detailsEl.innerHTML.includes('Carregando')) {
      try {
        const response = await fetch(`/api/lessons/${lessonId}`);
        const lesson = await response.json();
        detailsEl.innerHTML = formatLessonDetails(lesson);
      } catch (error) {
        detailsEl.innerHTML = '<p class="error">Erro ao carregar detalhes da aula.</p>';
      }
    }
  } else {
    // Colapsar
    detailsEl.style.display = 'none';
    iconEl.textContent = '▼';
  }
}

function formatLessonDetails(lesson) {
  const enriched = lesson.enriched;
  
  if (!enriched) {
    return '<p class="error">Aula não foi enriquecida ainda.</p>';
  }
  
  return `
    <div class="lesson-section">
      <h4>📝 Resumo</h4>
      <p>${enriched.summary}</p>
    </div>
    
    <div class="lesson-section">
      <h4>🎯 Tópicos Principais</h4>
      <ul class="topics-list">
        ${enriched.mainTopics.map(topic => `<li>${topic}</li>`).join('')}
      </ul>
    </div>
    
    ${enriched.vocabulary && enriched.vocabulary.length > 0 ? `
      <div class="lesson-section">
        <h4>📚 Vocabulário (${enriched.vocabulary.length} palavras)</h4>
        <div class="vocab-grid">
          ${enriched.vocabulary.map(item => `
            <div class="vocab-card-mini">
              <strong>${item.word}</strong>
              <span class="translation">${item.translation || '—'}</span>
              <span class="pronunciation">${item.pronunciation || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${enriched.grammar && enriched.grammar.length > 0 ? `
      <div class="lesson-section">
        <h4>✏️ Gramática (${enriched.grammar.length} tópicos)</h4>
        <ul class="grammar-list">
          ${enriched.grammar.map(item => `
            <li>
              <strong>${item.topic}</strong>
              <p>${item.explanation}</p>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : ''}
    
    ${enriched.expressions && enriched.expressions.length > 0 ? `
      <div class="lesson-section">
        <h4>💬 Expressões Úteis</h4>
        <div class="expressions-grid">
          ${enriched.expressions.map(exp => `
            <div class="expression-card">
              <strong>${exp.expression}</strong>
              <span>${exp.meaning || exp.translation || exp.usage || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${enriched.originalExamples && enriched.originalExamples.length > 0 ? `
      <div class="lesson-section">
        <h4>📖 Frases Originais da Aula</h4>
        <div class="examples-list">
          ${enriched.originalExamples.map(example => `<div class="example-item">${example}</div>`).join('')}
        </div>
      </div>
    ` : ''}
    
    ${enriched.practiceQuestions && enriched.practiceQuestions.length > 0 ? `
      <div class="lesson-section">
        <h4>📝 Exercícios (${enriched.practiceQuestions.length})</h4>
        <p class="hint">Use a área de estudo acima para praticar!</p>
      </div>
    ` : ''}
  `;
}

// Tornar função global para o onclick
window.toggleLesson = toggleLesson;

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
  
  // Atualizar conteúdo
  const questionEl = document.getElementById('card-question');
  const answerEl = document.getElementById('card-answer');
  
  switch (item.category) {
    case 'vocabulary':
      questionEl.innerHTML = `
        <h3>${item.word}</h3>
        <p style="color: #666; margin-top: 10px;">${item.partOfSpeech || 'word'}</p>
      `;
      answerEl.innerHTML = `
        <h4>📖 Tradução</h4>
        <p><strong>${item.translation}</strong></p>
        
        <h4 style="margin-top: 15px;">💬 Definição</h4>
        <p>${item.definition || 'N/A'}</p>
        
        ${item.examples && item.examples.length > 0 ? `
          <h4 style="margin-top: 15px;">📝 Exemplos</h4>
          <ul style="margin-left: 20px;">
            ${item.examples.map(ex => `<li>${ex}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${item.synonyms && item.synonyms.length > 0 ? `
          <p style="margin-top: 10px;"><strong>Sinônimos:</strong> ${item.synonyms.join(', ')}</p>
        ` : ''}
      `;
      break;
      
    case 'question':
      questionEl.innerHTML = `
        ${item.tense ? `<p class="tense-badge" style="background: #667eea; color: white; display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 12px;">📚 ${item.tense}</p>` : ''}
        <h3>${item.question}</h3>
      `;
      answerEl.innerHTML = `
        <h4>✅ Resposta</h4>
        <p><strong>${item.answer}</strong></p>
        ${item.explanation ? `
          <h4 style="margin-top: 15px;">💡 Explicação</h4>
          <p>${item.explanation}</p>
        ` : ''}
      `;
      break;
      
    case 'grammar':
      questionEl.innerHTML = `<h3>${item.topic}</h3>`;
      answerEl.innerHTML = `
        <h4>📚 Explicação</h4>
        <p>${item.explanation}</p>
        
        ${item.rules && item.rules.length > 0 ? `
          <h4 style="margin-top: 15px;">📋 Regras</h4>
          <ul style="margin-left: 20px;">
            ${item.rules.map(rule => `<li>${rule}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${item.examples && item.examples.length > 0 ? `
          <h4 style="margin-top: 15px;">📝 Exemplos</h4>
          <ul style="margin-left: 20px;">
            ${item.examples.map(ex => `<li>${ex}</li>`).join('')}
          </ul>
        ` : ''}
      `;
      break;
  }
  
  // Reset UI
  answerEl.style.display = 'none';
  document.getElementById('show-answer-btn').style.display = 'block';
  document.getElementById('rating-buttons').style.display = 'none';
}

function finishStudySession() {
  document.getElementById('study-area').innerHTML = `
    <div class="message">
      <h3>🎊 Sessão Concluída!</h3>
      <p>Você revisou ${currentItems.length} itens hoje.</p>
      <p>Continue assim para manter seu progresso!</p>
      <button class="btn btn-primary" onclick="location.reload()">Recarregar Página</button>
    </div>
  `;
  loadStats(); // Atualizar estatísticas
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  document.getElementById('show-answer-btn').addEventListener('click', () => {
    document.getElementById('card-answer').style.display = 'block';
    document.getElementById('show-answer-btn').style.display = 'none';
    document.getElementById('rating-buttons').style.display = 'block';
  });
  
  document.querySelectorAll('.btn-rating').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const quality = parseInt(e.currentTarget.dataset.quality);
      await submitReview(quality);
    });
  });
}

async function submitReview(quality) {
  const item = currentItems[currentIndex];
  
  try {
    const response = await fetch('/api/study/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: item.id,
        quality: quality,
        lessonId: item.lessonId
      })
    });
    
    if (response.ok) {
      currentIndex++;
      showCurrentCard();
    }
  } catch (error) {
    console.error('Erro ao registrar revisão:', error);
  }
}

// ============================================
// UTILS
// ============================================

function getCategoryLabel(category) {
  const labels = {
    vocabulary: '📚 Vocabulário',
    question: '❓ Exercício',
    grammar: '✏️ Gramática'
  };
  return labels[category] || category;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
}
