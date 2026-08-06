// Editor Completo de Aulas
let currentCategory = null;
let currentLessonId = null;
let categoryAdapter = null;
let lessonData = {
  date: '',
  title: '',
  rawContent: '',
  enriched: {
    summary: '',
    mainTopics: [],
    vocabulary: [],
    grammar: [],
    practiceQuestions: [],
    supportMaterials: []
  }
};

function getCategoryIdFromContext() {
  if (currentCategory && typeof currentCategory === 'object' && currentCategory.id) {
    return currentCategory.id;
  }

  if (typeof currentCategory === 'string' && currentCategory.trim()) {
    return currentCategory;
  }

  const params = new URLSearchParams(window.location.search);
  const categoryFromUrl = params.get('category');
  if (categoryFromUrl && categoryFromUrl !== '[object Object]') {
    return categoryFromUrl;
  }

  return null;
}

function goBackToLessonList() {
  const categoryId = getCategoryIdFromContext();

  if (!categoryId) {
    window.location.href = '/?manager';
    return;
  }

  window.location.href = `/manage.html?category=${encodeURIComponent(categoryId)}`;
}

function goBackToManager() {
  window.location.href = '/?manager';
}

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const categoryId = params.get('category');
  currentLessonId = params.get('lesson');
  
  if (!categoryId || categoryId === '[object Object]') {
    alert('Categoria inválida ou não especificada!');
    goBackToManager();
    return;
  }
  
  // Carregar informações da categoria
  await loadCategoryInfo(categoryId);
  
  // Set default date to today
  document.getElementById('lesson-date').valueAsDate = new Date();
  
  // Setup image upload listener
  const imageUpload = document.getElementById('image-upload');
  const dropZone = document.getElementById('drop-zone');
  
  if (imageUpload && dropZone) {
    // Click na drop zone abre file picker
    dropZone.addEventListener('click', () => {
      imageUpload.click();
    });
    
    // File input change
    imageUpload.addEventListener('change', handleImageSelect);
    
    // Drag and drop eventos
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
  }
  
  // Paste de imagem (Ctrl+V)
  document.addEventListener('paste', handlePaste);
  document.addEventListener('keydown', handleAiContentModalKeydown);

  setupAiContentModal();
  
  // Se é edição, carregar dados
  if (currentLessonId) {
    loadLesson();
  } else {
    // Nova aula: inicializar com estrutura da categoria
    if (categoryAdapter) {
      lessonData = categoryAdapter.getEmptyLessonData();
    }
  }
});

// Carregar informações da categoria
async function loadCategoryInfo(categoryId) {
  try {
    const response = await fetch('/api/categories');
    const data = await response.json();
    currentCategory = data.categories.find(c => c.id === categoryId);
    
    if (currentCategory) {
      categoryAdapter = new CategoryAdapter(currentCategory);
      console.log('Categoria carregada:', currentCategory);
      console.log('Tipo de categoria:', currentCategory.type || 'language');
      
      // Renderizar tabs dinâmicas baseadas no tipo
      renderDynamicTabs();
    }
  } catch (error) {
    console.error('Erro ao carregar categoria:', error);
  }
}

// Renderizar tabs dinâmicas baseadas no tipo de categoria
function renderDynamicTabs() {
  if (!categoryAdapter) return;
  
  const availableTabs = categoryAdapter.getEditorTabs();
  const availableTabIds = availableTabs.map(t => t.id);
  
  // Ocultar tabs não relevantes para o tipo
  const allTabs = document.querySelectorAll('.tab');
  const allTabContents = document.querySelectorAll('.tab-content');
  
  allTabs.forEach(tab => {
    const tabId = tab.getAttribute('onclick')?.match(/showTab\('(.+?)'\)/)?.[1];
    if (!tabId) return;
    
    if (availableTabIds.includes(tabId) || tabId === 'basic' || tabId === 'questions' || tabId === 'topics' || tabId === 'aicontent') {
      tab.style.display = 'block';
    } else {
      // Ocultar tabs não relevantes (vocabulary, grammar para technology)
      tab.style.display = 'none';
    }
  });
  
  // Ocultar conteúdo das tabs não relevantes
  allTabContents.forEach(content => {
    const tabId = content.id.replace('tab-', '');
    if (!availableTabIds.includes(tabId) && tabId !== 'basic' && tabId !== 'questions' && tabId !== 'topics' && tabId !== 'aicontent') {
      content.style.display = 'none';
    }
  });
  
  // Adicionar mensagem informativa para categorias de tecnologia
  if (currentCategory.type === 'technology') {
    const vocabularyTab = document.getElementById('tab-vocabulary');
    const grammarTab = document.getElementById('tab-grammar');
    
    if (vocabularyTab) {
      vocabularyTab.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #fef3c7; border-radius: 12px;">
          <h3 style="color: #f59e0b; margin-bottom: 16px;">💡 Categoria de Tecnologia</h3>
          <p style="color: #92400e; font-size: 1.1rem;">
            Esta é uma categoria de <strong>tecnologia/certificação</strong>.<br>
            Vocabulário não se aplica a este tipo de conteúdo.<br><br>
            Use as abas <strong>Tópicos</strong> e <strong>Exercícios</strong> para organizar o conteúdo.
          </p>
        </div>
      `;
    }
    
    if (grammarTab) {
      grammarTab.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #fef3c7; border-radius: 12px;">
          <h3 style="color: #f59e0b; margin-bottom: 16px;">💡 Categoria de Tecnologia</h3>
          <p style="color: #92400e; font-size: 1.1rem;">
            Esta é uma categoria de <strong>tecnologia/certificação</strong>.<br>
            Gramática não se aplica a este tipo de conteúdo.<br><br>
            Use as abas <strong>Tópicos</strong> e <strong>Exercícios</strong> para organizar o conteúdo.
          </p>
        </div>
      `;
    }
    
    // Ajustar formulário de exercícios para tecnologia
    const tenseGroup = document.getElementById('question-tense-group');
    const topicGroup = document.getElementById('question-topic-group');
    const questionType = document.getElementById('question-type');
    const questionText = document.getElementById('question-text');
    const questionAnswer = document.getElementById('question-answer');
    
    if (tenseGroup) tenseGroup.style.display = 'none';
    if (topicGroup) topicGroup.style.display = 'block';
    
    // Atualizar placeholders para tecnologia
    if (questionText) {
      questionText.placeholder = 'Ex: Qual comando do Azure CLI lista todas as VMs?';
    }
    if (questionAnswer) {
      questionAnswer.placeholder = 'Ex: az vm list';
    }
    
    // Atualizar opções de tipo de exercício para tecnologia
    if (questionType) {
      questionType.innerHTML = `
        <option value="multiple-choice">Múltipla Escolha</option>
        <option value="scenario">Cenário Prático</option>
        <option value="command">Comando/Sintaxe</option>
        <option value="troubleshooting">Solução de Problemas</option>
        <option value="theory">Conceito Teórico</option>
      `;
    }
  } else {
    // Para idiomas, garantir que os campos corretos estão visíveis
    const tenseGroup = document.getElementById('question-tense-group');
    const topicGroup = document.getElementById('question-topic-group');
    const questionText = document.getElementById('question-text');
    const questionAnswer = document.getElementById('question-answer');
    
    if (tenseGroup) tenseGroup.style.display = 'block';
    if (topicGroup) topicGroup.style.display = 'none';
    
    // Restaurar placeholders para idiomas
    if (questionText) {
      questionText.placeholder = 'What is your favorite color?';
    }
    if (questionAnswer) {
      questionAnswer.placeholder = 'My favorite color is blue';
    }
  }
  
  console.log(`✅ Tabs configuradas para tipo: ${currentCategory.type || 'language'}`);
  console.log(`   Tabs disponíveis:`, availableTabIds);
}

// Carregar aula existente
async function loadLesson() {
  try {
    const response = await fetch(`/api/categories/${currentCategory.id}/lessons/${currentLessonId}`);
    if (!response.ok) throw new Error('Falha ao carregar aula');
    
    const lesson = await response.json();
    
    // Preencher campos básicos
    document.getElementById('lesson-date').value = lesson.date;
    document.getElementById('lesson-title-input').value = lesson.title;
    document.getElementById('lesson-summary').value = lesson.enriched?.summary || '';
    document.getElementById('lesson-content').value = lesson.rawContent || '';
    document.getElementById('lesson-title').textContent = `Editando: ${lesson.title}`;
    
    // Carregar estruturas complexas - adaptado ao tipo
    const enriched = lesson.enriched || {};
    
    // Carregar conteúdos AI gerados
    aiGeneratedContents = lesson.generatedContents || [];

    if (currentCategory?.type === 'technology') {
      // Para tecnologia, extrair títulos dos topics para mainTopics (para tab de tópicos simples)
      const topicTitles = (enriched.topics || []).map(t => t.title).filter(Boolean);
      
      lessonData = {
        date: lesson.date,
        title: lesson.title,
        rawContent: lesson.rawContent || '',
        enriched: {
          summary: enriched.summary || '',
          mainTopics: topicTitles,  // ← Array de strings extraído de topics
          keywords: enriched.keywords || [],
          topics: enriched.topics || [],  // ← Mantém estrutura completa
          concepts: enriched.concepts || [],
          commands: enriched.commands || [],
          scenarios: enriched.scenarios || [],
          exercises: enriched.exercises || [],
          examTips: enriched.examTips || [],
          resources: enriched.resources || [],
          practiceQuestions: enriched.practiceQuestions || enriched.exercises || [],
          supportMaterials: enriched.supportMaterials || []
        }
      };
    } else {
      // Language (padrão)
      lessonData = {
        date: lesson.date,
        title: lesson.title,
        rawContent: lesson.rawContent || '',
        enriched: {
          summary: enriched.summary || '',
          mainTopics: enriched.mainTopics || [],
          vocabulary: enriched.vocabulary || [],
          grammar: enriched.grammar || [],
          expressions: enriched.expressions || [],
          practiceQuestions: enriched.practiceQuestions || [],
          supportMaterials: enriched.supportMaterials || []
        }
      };
    }
    
    renderAllLists();
  } catch (error) {
    console.error('Erro detalhado ao carregar aula:', error);
    alert(`Erro ao carregar aula: ${error.message}`);
  }
}

// Navegação entre tabs
function showTab(tabName) {
  const clickedTab = event.currentTarget;
  
  // Remover active de todos
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  // Ativar tab clicada
  clickedTab.classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ============================================
// VOCABULÁRIO
// ============================================
function addVocabulary() {
  const word = document.getElementById('vocab-word').value.trim();
  const translation = document.getElementById('vocab-translation').value.trim();
  
  if (!word || !translation) {
    alert('Palavra e tradução são obrigatórios!');
    return;
  }
  
  const vocab = {
    word,
    translation,
    definition: document.getElementById('vocab-definition').value.trim() || '',
    pronunciation: document.getElementById('vocab-pronunciation').value.trim() || '',
    partOfSpeech: document.getElementById('vocab-pos').value,
    examples: document.getElementById('vocab-example').value.trim() 
      ? [document.getElementById('vocab-example').value.trim()] 
      : [],
    id: `vocab-${Date.now()}`,
    synonyms: [],
    difficulty: 'intermediate'
  };
  
  lessonData.enriched.vocabulary.push(vocab);
  renderVocabularyList();
  clearVocabForm();
}

function removeVocabulary(index) {
  if (confirm('Remover este vocabulário?')) {
    lessonData.enriched.vocabulary.splice(index, 1);
    renderVocabularyList();
  }
}

function clearVocabForm() {
  document.getElementById('vocab-word').value = '';
  document.getElementById('vocab-translation').value = '';
  document.getElementById('vocab-definition').value = '';
  document.getElementById('vocab-pronunciation').value = '';
  document.getElementById('vocab-example').value = '';
}

function renderVocabularyList() {
  const container = document.getElementById('vocabulary-list');
  const vocab = lessonData.enriched.vocabulary;
  
  if (!vocab || vocab.length === 0) {
    container.innerHTML = '<p class="hint">Nenhum vocabulário adicionado ainda.</p>';
    return;
  }
  
  container.innerHTML = vocab.map((v, idx) => `
    <div class="item-card">
      <button class="remove-btn" onclick="removeVocabulary(${idx})">🗑️</button>
      <div><strong>${v.word}</strong> (${v.partOfSpeech}) → <strong>${v.translation}</strong></div>
      ${v.pronunciation ? `<div style="color: #6b7280; font-size: 0.9rem;">${v.pronunciation}</div>` : ''}
      ${v.definition ? `<div style="margin-top: 5px;">${v.definition}</div>` : ''}
      ${v.examples && v.examples.length > 0 ? `<div style="margin-top: 5px; font-style: italic; color: #059669;">"${v.examples[0]}"</div>` : ''}
    </div>
  `).join('');
}

// ============================================
// GRAMÁTICA
// ============================================
function addGrammar() {
  const topic = document.getElementById('grammar-topic').value.trim();
  const explanation = document.getElementById('grammar-explanation').value.trim();
  
  if (!topic || !explanation) {
    alert('Tópico e explicação são obrigatórios!');
    return;
  }
  
  const rulesText = document.getElementById('grammar-rules').value.trim();
  const exampleText = document.getElementById('grammar-example').value.trim();
  
  const grammar = {
    topic,
    explanation,
    rules: rulesText ? rulesText.split('\n').filter(r => r.trim()) : [],
    examples: exampleText ? [exampleText] : [],
    commonMistakes: [],
    id: `grammar-${Date.now()}`
  };
  
  lessonData.enriched.grammar.push(grammar);
  renderGrammarList();
  clearGrammarForm();
}

function removeGrammar(index) {
  if (confirm('Remover este tópico de gramática?')) {
    lessonData.enriched.grammar.splice(index, 1);
    renderGrammarList();
  }
}

function clearGrammarForm() {
  document.getElementById('grammar-topic').value = '';
  document.getElementById('grammar-explanation').value = '';
  document.getElementById('grammar-rules').value = '';
  document.getElementById('grammar-example').value = '';
}

function renderGrammarList() {
  const container = document.getElementById('grammar-list');
  const grammar = lessonData.enriched.grammar;
  
  if (!grammar || grammar.length === 0) {
    container.innerHTML = '<p class="hint">Nenhum tópico de gramática adicionado ainda.</p>';
    return;
  }
  
  container.innerHTML = grammar.map((g, idx) => `
    <div class="item-card">
      <button class="remove-btn" onclick="removeGrammar(${idx})">🗑️</button>
      <div><strong>📖 ${g.topic}</strong></div>
      <div style="margin-top: 8px;">${g.explanation}</div>
      ${g.rules && g.rules.length > 0 ? `<ul style="margin-top: 8px;">${g.rules.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
      ${g.examples && g.examples.length > 0 ? `<div style="margin-top: 8px; font-style: italic; color: #059669;">"${g.examples[0]}"</div>` : ''}
    </div>
  `).join('');
}

// ============================================
// EXERCÍCIOS
// ============================================
function addQuestion() {
  const questionText = document.getElementById('question-text').value.trim();
  const answer = document.getElementById('question-answer').value.trim();
  
  if (!questionText || !answer) {
    alert('Pergunta e resposta são obrigatórios!');
    return;
  }
  
  const question = {
    question: questionText,
    answer,
    explanation: document.getElementById('question-explanation').value.trim() || '',
    type: document.getElementById('question-type').value,
    id: `question-${Date.now()}`
  };
  
  // Adicionar campo específico baseado no tipo de categoria
  if (currentCategory?.type === 'technology') {
    // Para tecnologia: adicionar tópico relacionado
    question.topic = document.getElementById('question-topic').value.trim() || '';
  } else {
    // Para idiomas: adicionar tempo verbal (tense)
    question.tense = document.getElementById('question-tense').value.trim() || '';
  }
  
  lessonData.enriched.practiceQuestions.push(question);
  renderQuestionsList();
  clearQuestionForm();
}

function removeQuestion(index) {
  if (confirm('Remover este exercício?')) {
    lessonData.enriched.practiceQuestions.splice(index, 1);
    renderQuestionsList();
  }
}

function clearQuestionForm() {
  document.getElementById('question-text').value = '';
  document.getElementById('question-answer').value = '';
  document.getElementById('question-explanation').value = '';
  document.getElementById('question-tense').value = '';
  document.getElementById('question-topic').value = '';
}

function renderQuestionsList() {
  const container = document.getElementById('questions-list');
  const questions = lessonData.enriched.practiceQuestions;
  
  if (!questions || questions.length === 0) {
    container.innerHTML = '<p class="hint">Nenhum exercício adicionado ainda.</p>';
    return;
  }
  
  container.innerHTML = questions.map((q, idx) => {
    // Determinar qual tag exibir baseado no tipo de categoria
    let contextTag = '';
    if (currentCategory?.type === 'technology' && q.topic) {
      contextTag = `<span style="background: #fce7f3; padding: 2px 8px; border-radius: 4px; margin-left: 5px;">📚 ${q.topic}</span>`;
    } else if (q.tense) {
      contextTag = `<span style="background: #fce7f3; padding: 2px 8px; border-radius: 4px; margin-left: 5px;">⏰ ${q.tense}</span>`;
    }
    
    return `
      <div class="item-card">
        <button class="remove-btn" onclick="removeQuestion(${idx})">🗑️</button>
        <div><strong>❓ ${q.question}</strong></div>
        <div style="margin-top: 8px; color: #059669;"><strong>Resposta:</strong> ${q.answer}</div>
        ${q.explanation ? `<div style="margin-top: 5px; font-size: 0.9rem; color: #6b7280;">${q.explanation}</div>` : ''}
        <div style="margin-top: 5px; font-size: 0.85rem;">
          <span style="background: #dbeafe; padding: 2px 8px; border-radius: 4px;">${q.type}</span>
          ${contextTag}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// TÓPICOS PRINCIPAIS
// ============================================
function addTopic() {
  const topic = document.getElementById('topic-input').value.trim();
  
  if (!topic) {
    alert('Digite um tópico!');
    return;
  }
  
  if (lessonData.enriched.mainTopics.includes(topic)) {
    alert('Tópico já adicionado!');
    return;
  }
  
  lessonData.enriched.mainTopics.push(topic);
  renderTopicsList();
  document.getElementById('topic-input').value = '';
}

function removeTopic(index) {
  lessonData.enriched.mainTopics.splice(index, 1);
  renderTopicsList();
}

function renderTopicsList() {
  const container = document.getElementById('topics-list');
  const topics = lessonData.enriched.mainTopics;
  
  if (!topics || topics.length === 0) {
    container.innerHTML = '<p class="hint">Nenhum tópico principal adicionado ainda.</p>';
    return;
  }
  
  container.innerHTML = topics.map((topic, idx) => `
    <span class="chip">
      ${topic}
      <span class="remove" onclick="removeTopic(${idx})">×</span>
    </span>
  `).join('');
}

// ============================================
// MATERIAIS DE APOIO
// ============================================
function addSupportMaterial() {
  const title = document.getElementById('material-title-input').value.trim();
  const url = document.getElementById('material-url-input').value.trim();
  
  if (!title || !url) {
    alert('Preencha título e URL!');
    return;
  }
  
  // Validar URL
  try {
    new URL(url);
  } catch (e) {
    alert('URL inválida! Use formato: https://...');
    return;
  }
  
  if (!lessonData.enriched.supportMaterials) {
    lessonData.enriched.supportMaterials = [];
  }
  
  lessonData.enriched.supportMaterials.push({
    title: title,
    url: url,
    type: detectMaterialType(url)
  });
  
  renderSupportMaterialsList();
  document.getElementById('material-title-input').value = '';
  document.getElementById('material-url-input').value = '';
}

function detectMaterialType(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'video';
  }
  if (urlLower.includes('pdf')) {
    return 'pdf';
  }
  if (urlLower.includes('docs.google.com') || urlLower.includes('microsoft.com')) {
    return 'document';
  }
  return 'link';
}

function removeSupportMaterial(index) {
  lessonData.enriched.supportMaterials.splice(index, 1);
  renderSupportMaterialsList();
}

function renderSupportMaterialsList() {
  const container = document.getElementById('materials-list');
  const materials = lessonData.enriched.supportMaterials;
  
  if (!materials || materials.length === 0) {
    container.innerHTML = '<p class="hint">Nenhum material de apoio adicionado ainda.</p>';
    return;
  }
  
  const typeIcons = {
    video: '🎥',
    pdf: '📄',
    document: '📝',
    link: '🔗'
  };
  
  container.innerHTML = materials.map((material, idx) => `
    <div class="list-item">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 1.2rem;">${typeIcons[material.type] || '🔗'}</span>
          <strong>${material.title}</strong>
        </div>
        <a href="${material.url}" target="_blank" style="color: #667eea; font-size: 0.9rem; word-break: break-all;">
          ${material.url}
        </a>
      </div>
      <button onclick="removeSupportMaterial(${idx})" class="btn-icon" title="Remover">🗑️</button>
    </div>
  `).join('');
}

// ============================================
// KEYWORDS (PARA TECNOLOGIA)
// ============================================
function addKeyword() {
  if (!lessonData.enriched.keywords) {
    lessonData.enriched.keywords = [];
  }

  const term = prompt('Digite o termo técnico:');
  if (!term) return;
  
  const definition = prompt('Digite a definição:');
  if (!definition) return;
  
  const keyword = {
    term,
    definition,
    examples: [],
    relatedConcepts: [],
    id: `keyword-${Date.now()}`
  };
  
  lessonData.enriched.keywords.push(keyword);
  renderKeywordsList();
}

function removeKeyword(index) {
  if (confirm('Remover este termo?')) {
    lessonData.enriched.keywords.splice(index, 1);
    renderKeywordsList();
  }
}

function renderKeywordsList() {
  const container = document.getElementById('keywords-list');
  if (!container) return; // Tab pode não existir em categorias language
  
  const keywords = lessonData.enriched.keywords || [];
  
  if (keywords.length === 0) {
    container.innerHTML = '<p class="hint">Nenhum termo adicionado ainda.</p>';
    return;
  }
  
  container.innerHTML = keywords.map((k, idx) => `
    <div class="item-card">
      <button class="remove-btn" onclick="removeKeyword(${idx})">🗑️</button>
      <div><strong>${k.term}</strong></div>
      <div style="margin-top: 5px;">${k.definition}</div>
    </div>
  `).join('');
}

// ============================================
// TOPICS (PARA TECNOLOGIA)
// ============================================
function addTopicSection() {
  if (!lessonData.enriched.topics) {
    lessonData.enriched.topics = [];
  }
  
  const title = prompt('Digite o título do tópico:');
  if (!title) return;
  
  const description = prompt('Digite a descrição:');
  
  const topic = {
    title,
    description: description || '',
    keyPoints: [],
    urls: [],
    id: `topic-${Date.now()}`
  };
  
  lessonData.enriched.topics.push(topic);
  renderTopicsSectionsList();
}

function removeTopicSection(index) {
  if (confirm('Remover este tópico?')) {
    lessonData.enriched.topics.splice(index, 1);
    renderTopicsSectionsList();
  }
}

function renderTopicsSectionsList() {
  const container = document.getElementById('topics-sections-list');
  if (!container) return; // Tab pode não existir em categorias language
  
  const topics = lessonData.enriched.topics || [];
  
  if (topics.length === 0) {
    container.innerHTML = '<p class="hint">Nenhum tópico adicionado ainda.</p>';
    return;
  }
  
  container.innerHTML = topics.map((t, idx) => `
    <div class="item-card">
      <button class="remove-btn" onclick="removeTopicSection(${idx})">🗑️</button>
      <div><strong>📚 ${t.title}</strong></div>
      ${t.description ? `<div style="margin-top: 5px;">${t.description}</div>` : ''}
    </div>
  `).join('');
}

// ============================================
// SALVAR
// ============================================
async function saveLesson() {
  // Coletar dados básicos
  lessonData.date = document.getElementById('lesson-date').value;
  lessonData.title = document.getElementById('lesson-title-input').value.trim();
  lessonData.rawContent = document.getElementById('lesson-content').value.trim();
  lessonData.enriched.summary = document.getElementById('lesson-summary').value.trim();
  
  if (!lessonData.date || !lessonData.title) {
    alert('Data e título são obrigatórios!');
    return;
  }
  
  const saveBtn = document.getElementById('save-btn');
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="loading-spinner"></span> Salvando...';
  
  try {
    let response;
    if (currentLessonId) {
      // Update
      response = await fetch(`/api/categories/${currentCategory.id}/lessons/${currentLessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonData)
      });
    } else {
      // Create
      response = await fetch(`/api/categories/${currentCategory.id}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonData)
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao salvar aula');
    }
    
    const result = await response.json();
    alert(currentLessonId ? 'Aula atualizada com sucesso!' : 'Aula criada com sucesso!');
    goBackToLessonList();
  } catch (error) {
    alert(`Erro: ${error.message}`);
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

// Renderizar todas as listas
function renderAllLists() {
  // Para categorias de idioma
  if (currentCategory?.type === 'language' || !currentCategory?.type) {
    if (typeof renderVocabularyList === 'function' && lessonData.enriched.vocabulary) {
      renderVocabularyList();
    }
    if (typeof renderGrammarList === 'function' && lessonData.enriched.grammar) {
      renderGrammarList();
    }
  }
  
  // Para categorias de tecnologia
  if (currentCategory?.type === 'technology') {
    if (typeof renderKeywordsList === 'function' && lessonData.enriched.keywords) {
      renderKeywordsList();
    }
    if (typeof renderTopicsSectionsList === 'function' && lessonData.enriched.topics) {
      renderTopicsSectionsList();
    }
  }
  
  // Comuns a todos
  if (typeof renderQuestionsList === 'function' && lessonData.enriched.practiceQuestions) {
    renderQuestionsList();
  }
  if (typeof renderTopicsList === 'function' && lessonData.enriched.mainTopics) {
    renderTopicsList();
  }
  if (typeof renderSupportMaterialsList === 'function' && lessonData.enriched.supportMaterials) {
    renderSupportMaterialsList();
  }

  // Conteúdo AI
  if (typeof renderAiContentList === 'function') {
    renderAiContentList();
  }
}

// ============================================
// CONTEÚDO AI
// ============================================
let aiGeneratedContents = [];
let aiContentSelectedImages = [];
let aiMermaidInitialized = false;

function setupAiContentModal() {
  const dropZone = document.getElementById('ai-content-drop-zone');
  const imageInput = document.getElementById('ai-content-image-input');

  if (dropZone && imageInput) {
    dropZone.addEventListener('click', () => imageInput.click());
    dropZone.addEventListener('dragover', handleAiContentDragOver);
    dropZone.addEventListener('dragleave', handleAiContentDragLeave);
    dropZone.addEventListener('drop', handleAiContentDrop);
  }

  document.addEventListener('paste', handleAiContentPaste);
}

function openAiContentModal() {
  const modal = document.getElementById('ai-content-modal');
  const promptInput = document.getElementById('ai-content-prompt-modal');
  const resultDiv = document.getElementById('ai-content-result');

  if (!modal || !promptInput || !resultDiv) {
    return;
  }

  aiContentSelectedImages = [];
  promptInput.value = '';
  resultDiv.style.display = 'none';
  resultDiv.classList.remove('is-error');
  resultDiv.innerHTML = '';

  resetAiContentImagePreview();
  modal.classList.remove('maximized');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ai-modal-open');
  updateAiContentMaximizeButton();
}

function closeAiContentModal() {
  const modal = document.getElementById('ai-content-modal');
  if (!modal) {
    return;
  }

  modal.classList.remove('open', 'maximized');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('ai-modal-open');
  aiContentSelectedImages = [];
  resetAiContentImagePreview();
}

function toggleAiContentModalMaximize() {
  const modal = document.getElementById('ai-content-modal');
  if (!modal) {
    return;
  }

  modal.classList.toggle('maximized');
  updateAiContentMaximizeButton();
}

function handleAiContentModalKeydown(event) {
  const modal = document.getElementById('ai-content-modal');
  if (!modal || !modal.classList.contains('open')) {
    return;
  }

  if (event.key === 'Escape') {
    closeAiContentModal();
  }
}

function updateAiContentMaximizeButton() {
  const modal = document.getElementById('ai-content-modal');
  const button = document.getElementById('ai-content-maximize-btn');
  if (!modal || !button) {
    return;
  }

  const isMaximized = modal.classList.contains('maximized');
  button.textContent = isMaximized ? '🗗' : '⛶';
  button.title = isMaximized ? 'Restaurar' : 'Maximizar';
  button.setAttribute('aria-label', button.title);
}

function resetAiContentImagePreview() {
  const preview = document.getElementById('ai-content-image-preview');
  const content = document.getElementById('ai-content-drop-text');
  const input = document.getElementById('ai-content-image-input');
  const thumbs = document.getElementById('ai-content-image-thumbs');
  const countLabel = document.getElementById('ai-content-image-count-label');

  if (preview) {
    preview.style.display = 'none';
  }
  if (content) {
    content.style.display = 'block';
  }
  if (thumbs) {
    thumbs.innerHTML = '';
  }
  if (countLabel) {
    countLabel.textContent = 'Imagens selecionadas: 0';
  }
  if (input) {
    input.value = '';
  }
}

function handleAiContentImageSelect(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  addAiContentImagesToQueue(files);
}

function addAiContentImagesToQueue(files) {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxSize = 20 * 1024 * 1024;
  const maxImages = 10;
  let added = 0;

  for (const file of files) {
    if (!validTypes.includes(file.type)) {
      alert(`Formato inválido: ${file.name}. Use JPEG ou PNG.`);
      continue;
    }

    if (file.size > maxSize) {
      alert(`Imagem muito grande: ${file.name}. Máximo 20MB por imagem.`);
      continue;
    }

    if (aiContentSelectedImages.length >= maxImages) {
      alert('Limite de 10 imagens por geração atingido.');
      break;
    }

    aiContentSelectedImages.push(file);
    added += 1;
  }

  if (added > 0) {
    renderAiContentImagePreviews();
  }

  const input = document.getElementById('ai-content-image-input');
  if (input) {
    input.value = '';
  }
}

function renderAiContentImagePreviews() {
  const preview = document.getElementById('ai-content-image-preview');
  const content = document.getElementById('ai-content-drop-text');
  const thumbs = document.getElementById('ai-content-image-thumbs');
  const countLabel = document.getElementById('ai-content-image-count-label');

  if (!preview || !content || !thumbs || !countLabel) {
    return;
  }

  if (!aiContentSelectedImages.length) {
    resetAiContentImagePreview();
    return;
  }

  preview.style.display = 'block';
  content.style.display = 'none';
  countLabel.textContent = `Imagens selecionadas: ${aiContentSelectedImages.length}`;
  thumbs.innerHTML = '';

  aiContentSelectedImages.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumb = document.createElement('div');
      thumb.className = 'ai-image-thumb';
      thumb.innerHTML = `
        <img src="${e.target.result}" alt="Imagem ${idx + 1}" title="${escapeHtmlAi(file.name)}">
        <span class="ai-image-index">${idx + 1}</span>
        <button type="button" class="ai-image-remove-btn" onclick="removeAiContentImage(${idx}, event)" title="Remover">✕</button>
      `;
      thumbs.appendChild(thumb);
    };
    reader.readAsDataURL(file);
  });
}

function removeAiContentImage(idx, event) {
  if (event) {
    event.stopPropagation();
  }

  aiContentSelectedImages.splice(idx, 1);
  renderAiContentImagePreviews();
}

function clearAiContentImages(event) {
  if (event) {
    event.stopPropagation();
  }

  aiContentSelectedImages = [];
  resetAiContentImagePreview();
}

function clearAiContentImage(event) {
  clearAiContentImages(event);
}

function handleAiContentDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('drag-over');
}

function handleAiContentDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('drag-over');
}

function handleAiContentDrop(event) {
  event.preventDefault();
  event.stopPropagation();

  const dropZone = event.currentTarget;
  dropZone.classList.remove('drag-over');

  const files = Array.from(event.dataTransfer.files || []);
  if (files.length) {
    addAiContentImagesToQueue(files);
  }
}

function handleAiContentPaste(event) {
  const modal = document.getElementById('ai-content-modal');
  if (!modal || !modal.classList.contains('open')) {
    return;
  }

  const activeElement = document.activeElement;
  const isEditableField = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.isContentEditable
  );

  if (isEditableField) {
    return;
  }

  const items = event.clipboardData?.items;
  if (!items) {
    return;
  }

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const blob = item.getAsFile();
      if (!blob) {
        break;
      }

      const extension = blob.type.split('/')[1];
      const fileName = `pasted-image-${Date.now()}.${extension}`;
      const file = new File([blob], fileName, { type: blob.type });
      addAiContentImagesToQueue([file]);
      break;
    }
  }
}

async function generateAiContent() {
  const promptInput = document.getElementById('ai-content-prompt-modal');
  const prompt = promptInput.value.trim();

  if (!prompt) {
    alert('Digite um prompt para a IA!');
    return;
  }

  if (!currentLessonId) {
    alert('Salve a aula primeiro antes de gerar conteúdo AI.');
    return;
  }

  const btn = document.getElementById('ai-content-modal-generate-btn');
  const resultDiv = document.getElementById('ai-content-result');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Gerando...';
  resultDiv.style.display = 'none';
  resultDiv.classList.remove('is-error');
  resultDiv.innerHTML = '';

  try {
    let response;
    if (aiContentSelectedImages.length > 0) {
      const formData = new FormData();
      formData.append('prompt', prompt);
      aiContentSelectedImages.forEach(file => {
        formData.append('images', file);
      });
      response = await fetch(`/api/categories/${currentCategory.id}/lessons/${currentLessonId}/generate`, {
        method: 'POST',
        body: formData
      });
    } else {
      response = await fetch(`/api/categories/${currentCategory.id}/lessons/${currentLessonId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
    }

    if (!response.ok) {
      let errorMessage = 'Erro ao gerar conteúdo';
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.error || errorMessage;
      } catch {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText.slice(0, 300);
        }
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      const bodyText = await response.text();
      throw new Error(`Resposta inesperada da API (não JSON): ${bodyText.slice(0, 120)}`);
    }

    // Adicionar ao array local
    aiGeneratedContents.push({
      id: `gen-${Date.now()}`,
      userPrompt: prompt,
      generatedContent: data.generated?.generatedContent || data.generated,
      generatedAt: new Date().toISOString()
    });

    renderAiContentList();
    promptInput.value = '';

    const generatedContent = data.generated?.generatedContent || data.generated;
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <h4 class="ai-result-title">✅ Conteúdo gerado com sucesso!</h4>
      <div class="ai-result-scroll">
        <div class="ai-result-body">
          ${formatAiGeneratedContent(generatedContent)}
        </div>
      </div>
      <p class="ai-result-meta">Total de conteúdos gerados nesta aula: ${aiGeneratedContents.length}</p>
    `;

    renderAiMermaidInContainer(resultDiv);

    aiContentSelectedImages = [];
    resetAiContentImagePreview();
  } catch (error) {
    resultDiv.style.display = 'block';
    resultDiv.classList.add('is-error');
    resultDiv.innerHTML = `<p class="ai-result-empty">❌ Erro: ${escapeHtmlAi(error.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Gerar Conteúdo';
  }
}

function removeAiContent(index) {
  if (!confirm('Remover este conteúdo AI gerado?')) return;

  aiGeneratedContents.splice(index, 1);

  // Salvar no servidor
  fetch(`/api/categories/${currentCategory.id}/lessons/${currentLessonId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generatedContents: aiGeneratedContents })
  });

  renderAiContentList();
}

function renderAiContentList() {
  const container = document.getElementById('ai-content-list');
  if (!container) return;

  if (!aiGeneratedContents || aiGeneratedContents.length === 0) {
    container.innerHTML = '<p class="hint">Nenhum conteúdo AI gerado ainda.</p>';
    return;
  }

  container.innerHTML = aiGeneratedContents.map((item, idx) => {
    const contentHtml = formatAiGeneratedContent(item.generatedContent);

    const date = item.generatedAt ? new Date(item.generatedAt).toLocaleString('pt-BR') : '';

    return `
      <div class="item-card">
        <button class="remove-btn" onclick="removeAiContent(${idx})">🗑️</button>
        <div style="margin-bottom:8px;">
          <strong style="color:#8b5cf6;">🧠 Prompt:</strong>
          <span style="color:#374151;">${escapeHtmlAi(item.userPrompt)}</span>
        </div>
        <div style="margin-bottom:8px;">
          <strong style="color:#059669;">📄 Conteúdo Gerado:</strong>
          <div class="ai-content-preview">${contentHtml}</div>
        </div>
        <div style="font-size:0.8rem; color:#9ca3af;">${date}</div>
      </div>
    `;
  }).join('');

  renderAiMermaidInContainer(container);
}

function formatAiGeneratedContent(content) {
  const normalized = normalizeAiContent(content);

  if (typeof normalized === 'string') {
    return `
      <div class="ai-content-block">
        <div class="ai-content-text">${renderAiStructuredContent(normalized)}</div>
      </div>
    `;
  }

  if (Array.isArray(normalized)) {
    return renderAiArray(normalized, 'Itens Gerados');
  }

  if (normalized && typeof normalized === 'object') {
    return renderAiObject(normalized);
  }

  return `
    <div class="ai-content-block">
      <div class="ai-content-text">Conteúdo vazio.</div>
    </div>
  `;
}

function normalizeAiContent(content) {
  if (typeof content !== 'string') {
    return content;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return content;
    }
  }

  return content;
}

function renderAiObject(obj) {
  const blocks = [];

  if (obj.title) {
    blocks.push(`<div class="ai-content-title">${escapeHtmlAi(obj.title)}</div>`);
  }

  if (obj.type) {
    blocks.push(`<div class="ai-content-type">${escapeHtmlAi(obj.type)}</div>`);
  }

  if (obj.content) {
    blocks.push(`<div class="ai-content-text">${renderAiStructuredContent(obj.content)}</div>`);
  }

  for (const [key, value] of Object.entries(obj)) {
    if (['title', 'type', 'content'].includes(key) || value == null || value === '') {
      continue;
    }

    blocks.push(renderAiSection(key, value));
  }

  return `<div class="ai-content-block">${blocks.join('')}</div>`;
}

function renderAiSection(key, value) {
  const title = formatAiLabel(key);

  if (Array.isArray(value)) {
    return `
      <div class="ai-content-block">
        <h4>${escapeHtmlAi(title)}</h4>
        ${renderAiArray(value, title)}
      </div>
    `;
  }

  if (value && typeof value === 'object') {
    return `
      <div class="ai-content-block">
        <h4>${escapeHtmlAi(title)}</h4>
        ${renderAiObjectFields(value)}
      </div>
    `;
  }

  return `
    <div class="ai-content-block">
      <h4>${escapeHtmlAi(title)}</h4>
      <div class="ai-content-text">${formatAiText(String(value))}</div>
    </div>
  `;
}

function renderAiArray(items, title) {
  if (!items.length) {
    return '<div class="ai-content-text">Nenhum item.</div>';
  }

  const primitivesOnly = items.every(item => item == null || ['string', 'number', 'boolean'].includes(typeof item));
  if (primitivesOnly) {
    return `
      <ul class="ai-content-list">
        ${items.map(item => `<li>${formatAiText(String(item ?? ''))}</li>`).join('')}
      </ul>
    `;
  }

  return `
    <div class="ai-content-grid">
      ${items.map((item, index) => `
        <div class="ai-content-card">
          <div class="ai-content-card-title">${escapeHtmlAi(title)} ${index + 1}</div>
          ${item && typeof item === 'object' ? renderAiObjectFields(item) : `<div class="ai-content-text">${formatAiText(String(item ?? ''))}</div>`}
        </div>
      `).join('')}
    </div>
  `;
}

function renderAiObjectFields(obj) {
  return Object.entries(obj)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => {
      const label = formatAiLabel(key);

      if (Array.isArray(value)) {
        return `
          <div style="margin-bottom: 12px;">
            <strong style="color:#374151; display:block; margin-bottom:6px;">${escapeHtmlAi(label)}</strong>
            ${renderAiArray(value, label)}
          </div>
        `;
      }

      if (value && typeof value === 'object') {
        return `
          <div style="margin-bottom: 12px;">
            <strong style="color:#374151; display:block; margin-bottom:6px;">${escapeHtmlAi(label)}</strong>
            <div class="ai-content-card">${renderAiStructuredContent(value)}</div>
          </div>
        `;
      }

      return `
        <div style="margin-bottom: 10px;">
          <strong style="color:#374151;">${escapeHtmlAi(label)}:</strong>
          <div class="ai-content-text" style="display:inline-block; margin-left:4px;">${renderAiStructuredContent(String(value))}</div>
        </div>
      `;
    }).join('');
}

function renderAiStructuredContent(content) {
  if (content == null || content === '') {
    return '<div class="ai-content-text">Conteúdo vazio.</div>';
  }

  if (typeof content === 'string') {
    return formatAiText(content);
  }

  if (Array.isArray(content)) {
    const primitivesOnly = content.every(item => item == null || ['string', 'number', 'boolean'].includes(typeof item));
    if (primitivesOnly) {
      return `
        <ul class="ai-content-list">
          ${content.map(item => `<li>${formatAiInlineText(String(item ?? ''))}</li>`).join('')}
        </ul>
      `;
    }

    return `
      <div class="ai-content-grid">
        ${content.map((item, index) => `
          <div class="ai-content-card">
            <div class="ai-content-card-title">Item ${index + 1}</div>
            ${typeof item === 'object' ? renderAiObjectFields(item) : `<div class="ai-content-text">${renderAiStructuredContent(String(item ?? ''))}</div>`}
          </div>
        `).join('')}
      </div>
    `;
  }

  if (typeof content === 'object') {
    const objectKeys = Object.keys(content);
    const hasRecognizedFields = objectKeys.some(key => ['title', 'type', 'content'].includes(key));

    if (hasRecognizedFields) {
      return renderAiObject(content);
    }

    return renderAiObjectFields(content);
  }

  return formatAiInlineText(String(content));
}

function formatAiLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, char => char.toUpperCase())
    .trim();
}

function formatAiText(text) {
  return renderAiMarkdown(text);
}

function renderAiMarkdown(text) {
  const normalized = normalizeLooseMermaidBlocks(String(text || '').replace(/\r\n/g, '\n'));
  let html;

  if (window.marked && typeof window.marked.parse === 'function') {
    html = window.marked.parse(normalized, {
      gfm: true,
      breaks: true
    });
  } else {
    html = normalized
      .split(/\n\n+/)
      .map((paragraph) => `<p>${escapeHtmlAi(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    html = window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['class', 'target', 'rel'],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
    });
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  wrapper.querySelectorAll('pre > code.language-mermaid, pre > code.lang-mermaid').forEach((codeEl) => {
    const pre = codeEl.parentElement;
    const mermaidBlock = document.createElement('div');
    mermaidBlock.className = 'mermaid';
    mermaidBlock.textContent = sanitizeMermaidSource(codeEl.textContent || '');
    if (pre && pre.parentElement) {
      pre.parentElement.replaceChild(mermaidBlock, pre);
    }
  });

  convertLooseMermaidParagraphs(wrapper);
  convertInlineMermaidParagraphs(wrapper);

  wrapper.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noreferrer noopener');
  });

  return wrapper.innerHTML;
}

function normalizeLooseMermaidBlocks(markdown) {
  const lines = markdown.split('\n');
  const result = [];
  let i = 0;

  const isMermaidStart = (line) => {
    const value = line.trim().toLowerCase();
    return value === 'mermaid';
  };

  const isDiagramLine = (line) => {
    const value = line.trim().toLowerCase();
    return /^(graph|flowchart|sequencediagram|classdiagram|statediagram|erdiagram|journey|gantt|pie|mindmap|timeline|quadrantchart|gitgraph|sankey)/.test(value);
  };

  while (i < lines.length) {
    const current = lines[i];
    if (!isMermaidStart(current)) {
      result.push(current);
      i += 1;
      continue;
    }

    const block = [];
    let j = i + 1;
    while (j < lines.length) {
      const candidate = lines[j];
      if (!candidate.trim()) {
        if (block.length === 0) {
          j += 1;
          continue;
        }
        break;
      }
      block.push(candidate);
      j += 1;
    }

    if (block.length > 0 && isDiagramLine(block[0])) {
      result.push('```mermaid');
      result.push(...block);
      result.push('```');
      i = j;
      continue;
    }

    result.push(current);
    i += 1;
  }

  return result.join('\n');
}

function sanitizeMermaidSource(source) {
  const normalized = String(source || '').replace(/\r\n/g, '\n');
  const diagramStart = /^(graph|flowchart|sequencediagram|classdiagram|statediagram|erdiagram|journey|gantt|pie|mindmap|timeline|quadrantchart|gitgraph|sankey)/i;

  let lines = normalized
    .split('\n')
    .map(line => line.replace(/\t/g, '  ').trimEnd())
    .filter(line => line.trim() !== '```' && line.trim().toLowerCase() !== '```mermaid');

  const startIndex = lines.findIndex(line => diagramStart.test(line.trim()));
  if (startIndex > 0) {
    lines = lines.slice(startIndex);
  }

  const cleaned = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      cleaned.push(line);
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      break;
    }

    cleaned.push(
      line
        .replace(/[→⇒]/g, '-->')
        .replace(/^[-*]\s+(graph|flowchart|sequencediagram|classdiagram|statediagram|erdiagram|journey|gantt|pie|mindmap|timeline|quadrantchart|gitgraph|sankey)/i, '$1')
    );
  }

  return cleaned.join('\n').trim();
}

function isLikelyMermaidSource(source) {
  const firstLine = String(source || '')
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return false;
  }

  return /^(graph|flowchart|sequencediagram|classdiagram|statediagram|erdiagram|journey|gantt|pie|mindmap|timeline|quadrantchart|gitgraph|sankey)/i.test(firstLine);
}

function convertLooseMermaidParagraphs(wrapper) {
  const paragraphs = Array.from(wrapper.querySelectorAll('p'));

  const isDiagramLine = (line) => {
    const value = line.trim().toLowerCase();
    return /^(graph|flowchart|sequencediagram|classdiagram|statediagram|erdiagram|journey|gantt|pie|mindmap|timeline|quadrantchart|gitgraph|sankey)/.test(value);
  };

  for (let index = 0; index < paragraphs.length; index += 1) {
    const marker = paragraphs[index];
    if (marker.textContent.trim().toLowerCase() !== 'mermaid') {
      continue;
    }

    const collected = [];
    const toRemove = [];
    let cursor = marker.nextElementSibling;
    while (cursor && cursor.tagName === 'P') {
      const line = cursor.textContent.trim();
      if (!line) {
        break;
      }
      collected.push(cursor.textContent);
      toRemove.push(cursor);
      cursor = cursor.nextElementSibling;
    }

    if (collected.length > 0 && isDiagramLine(collected[0])) {
      const mermaidBlock = document.createElement('div');
      mermaidBlock.className = 'mermaid';
      mermaidBlock.textContent = sanitizeMermaidSource(collected.join('\n'));
      marker.parentElement.replaceChild(mermaidBlock, marker);
      toRemove.forEach((node) => node.remove());
    }
  }
}

function convertInlineMermaidParagraphs(wrapper) {
  const paragraphs = Array.from(wrapper.querySelectorAll('p'));
  const diagramStart = /^(graph|flowchart|sequencediagram|classdiagram|statediagram|erdiagram|journey|gantt|pie|mindmap|timeline|quadrantchart|gitgraph|sankey)/i;

  paragraphs.forEach((paragraph) => {
    const raw = (paragraph.innerText || paragraph.textContent || '').replace(/\r\n/g, '\n').trim();
    if (!raw) return;

    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return;
    if (lines[0].toLowerCase() !== 'mermaid') return;
    if (!diagramStart.test(lines[1])) return;

    const mermaidBlock = document.createElement('div');
    mermaidBlock.className = 'mermaid';
    mermaidBlock.textContent = sanitizeMermaidSource(lines.slice(1).join('\n'));
    paragraph.parentElement.replaceChild(mermaidBlock, paragraph);
  });
}

async function renderAiMermaidInContainer(container) {
  if (!container || !window.mermaid) {
    return;
  }

  try {
    if (!aiMermaidInitialized) {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default'
      });
      aiMermaidInitialized = true;
    }

    const validNodes = Array.from(container.querySelectorAll('.mermaid'));
    for (let index = 0; index < validNodes.length; index += 1) {
      const node = validNodes[index];
      const source = sanitizeMermaidSource(node.textContent || '');

      if (!source || !isLikelyMermaidSource(source)) {
        node.remove();
        continue;
      }

      try {
        if (typeof window.mermaid.parse === 'function') {
          const parseResult = await window.mermaid.parse(source, { suppressErrors: true });
          if (parseResult === false) {
            throw new Error('Mermaid parse retornou inválido');
          }
        }

        const renderId = `ai-mermaid-${Date.now()}-${index}`;
        const rendered = await window.mermaid.render(renderId, source);

        if (!rendered || typeof rendered.svg !== 'string' || rendered.svg.includes('Syntax error in text')) {
          throw new Error('Mermaid retornou SVG de erro');
        }

        node.innerHTML = rendered.svg;
        node.classList.add('mermaid-rendered');
        if (typeof rendered.bindFunctions === 'function') {
          rendered.bindFunctions(node);
        }
      } catch (error) {
        const fallback = document.createElement('pre');
        fallback.className = 'ai-content-mermaid-fallback';
        fallback.textContent = source;
        if (node.parentElement) {
          node.parentElement.replaceChild(fallback, node);
        }
        console.warn('Falha ao renderizar Mermaid, mantendo código:', error);
      }
    }
  } catch (error) {
    console.warn('Falha ao renderizar Mermaid:', error);
  }
}

function formatAiInlineText(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  let html;

  if (window.marked && typeof window.marked.parseInline === 'function') {
    html = window.marked.parseInline(normalized);
  } else {
    html = escapeHtmlAi(normalized).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    html = window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['class', 'target', 'rel'],
      ALLOWED_TAGS: ['strong', 'em', 'code', 'a', 'span', 'br'],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
    });
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  wrapper.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noreferrer noopener');
  });

  return wrapper.innerHTML;
}

function escapeHtmlAi(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// UPLOAD DE IMAGEM (MÚLTIPLAS)
// ============================================

/** Lista de arquivos de imagem acumulados */
let uploadedImages = [];

/**
 * Adiciona arquivos validados à lista e atualiza o preview
 * @param {FileList|File[]} files 
 */
function addImagesToQueue(files) {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxSize = 20 * 1024 * 1024;
  let added = 0;

  for (const file of files) {
    if (!validTypes.includes(file.type)) {
      alert(`❌ Formato inválido: ${file.name}. Use JPEG ou PNG.`);
      continue;
    }
    if (file.size > maxSize) {
      alert(`❌ ${file.name} muito grande! Máximo 20MB.`);
      continue;
    }
    uploadedImages.push(file);
    added++;
  }

  if (added > 0) {
    renderImagePreviews();
  }
}

/**
 * Renderiza thumbnails de todas as imagens na fila
 */
function renderImagePreviews() {
  const preview = document.getElementById('image-preview');
  const thumbsContainer = document.getElementById('image-thumbs');
  const dropZone = document.getElementById('drop-zone');
  const countLabel = document.getElementById('image-count-label');

  if (uploadedImages.length === 0) {
    preview.style.display = 'none';
    dropZone.style.display = 'block';
    return;
  }

  preview.style.display = 'block';
  dropZone.style.display = 'none';
  countLabel.textContent = `Imagens selecionadas: ${uploadedImages.length}`;
  thumbsContainer.innerHTML = '';

  uploadedImages.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumb = document.createElement('div');
      thumb.style.cssText = 'position:relative; display:inline-block;';
      thumb.innerHTML = `
        <img src="${e.target.result}" style="width:120px; height:90px; object-fit:cover; border-radius:6px; border:2px solid #e5e7eb;" title="${file.name}">
        <span style="position:absolute; top:2px; left:6px; background:rgba(0,0,0,0.55); color:#fff; font-size:0.7rem; padding:1px 6px; border-radius:8px;">${idx + 1}</span>
        <button type="button" onclick="removeImage(${idx})" style="position:absolute; top:-6px; right:-6px; background:#ef4444; color:white; border:none; border-radius:50%; width:22px; height:22px; font-size:0.75rem; cursor:pointer; line-height:22px; text-align:center;" title="Remover">✕</button>
      `;
      thumbsContainer.appendChild(thumb);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Remove uma imagem da fila pelo índice
 */
function removeImage(idx) {
  uploadedImages.splice(idx, 1);
  renderImagePreviews();
}

/**
 * Manipula evento de dragover
 */
function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('drag-over');
}

/**
 * Manipula evento de dragleave
 */
function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('drag-over');
}

/**
 * Manipula evento de drop (múltiplas imagens)
 */
function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const dropZone = event.currentTarget;
  dropZone.classList.remove('drag-over');
  
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    addImagesToQueue(files);
  }
}

/**
 * Manipula evento de paste (Ctrl+V) - aceita imagens
 */
function handlePaste(event) {
  // Verificar se não está em um campo de texto editável
  const activeElement = document.activeElement;
  const isEditableField = activeElement.tagName === 'INPUT' || 
                          activeElement.tagName === 'TEXTAREA' || 
                          activeElement.isContentEditable;
  
  // Se está editando texto, não interceptar o paste
  if (isEditableField) {
    return;
  }
  
  // Pegar itens da área de transferência
  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Verificar se é imagem
    if (item.type.indexOf('image') !== -1) {
      event.preventDefault();
      
      const blob = item.getAsFile();
      
      // Criar nome para o arquivo
      const timestamp = new Date().getTime();
      const extension = blob.type.split('/')[1];
      const fileName = `pasted-image-${timestamp}.${extension}`;
      const file = new File([blob], fileName, { type: blob.type });
      
      addImagesToQueue([file]);
      showPasteNotification();
      break;
    }
  }
}

/**
 * Mostra notificação visual de paste bem-sucedido
 */
function showPasteNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(16, 185, 129, 0.4);
    font-weight: 600;
    font-size: 14px;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  
  notification.innerHTML = '✅ Imagem colada com sucesso!';
  document.body.appendChild(notification);
  
  // Remover após 3 segundos
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

/**
 * Manipula seleção de arquivos de imagem (múltiplos)
 */
function handleImageSelect(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  addImagesToQueue(files);
}

/**
 * Limpa todas as imagens do upload
 */
function clearImageUpload() {
  const imageUpload = document.getElementById('image-upload');
  const statusDiv = document.getElementById('ocr-status');
  const processBtn = document.getElementById('process-image-btn');
  
  imageUpload.value = '';
  uploadedImages = [];
  renderImagePreviews();
  statusDiv.style.display = 'none';
  processBtn.textContent = '🔍 Processar Imagens e Extrair Texto';
  processBtn.disabled = false;
}

/**
 * Processa múltiplas imagens com OCR
 */
async function processImageUpload() {
  if (uploadedImages.length === 0) return;
  
  const processBtn = document.getElementById('process-image-btn');
  const statusDiv = document.getElementById('ocr-status');
  
  // Desabilitar botão e mostrar status
  processBtn.disabled = true;
  processBtn.textContent = '⏳ Processando...';
  statusDiv.style.display = 'block';
  statusDiv.style.background = '#fef3c7';
  statusDiv.style.color = '#92400e';
  statusDiv.innerHTML = `🔄 Enviando ${uploadedImages.length} imagem(ns) para OCR...`;
  
  try {
    // Criar FormData com todas as imagens
    const formData = new FormData();
    uploadedImages.forEach((file, idx) => {
      formData.append('images', file);
    });
    formData.append('categoryId', currentCategory.id);
    
    // Enviar para o servidor
    const response = await fetch(`/api/categories/${currentCategory.id}/ocr`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao processar imagens');
    }
    
    const result = await response.json();
    
    // Preencher campo de conteúdo com texto extraído
    const contentField = document.getElementById('lesson-content');
    contentField.value = result.text;
    
    // Atualizar status
    statusDiv.style.background = '#d1fae5';
    statusDiv.style.color = '#065f46';
    statusDiv.innerHTML = `
      ✅ Texto extraído com sucesso!<br>
      📸 ${result.imageCount} imagem(ns) processada(s)<br>
      📊 Qualidade: ${result.quality} (${(result.confidence * 100).toFixed(1)}% confiança)<br>
      📝 ${result.metadata.lineCount} linhas, ${result.metadata.characterCount} caracteres
    `;
    
    if (result.quality === 'poor') {
      statusDiv.innerHTML += `<br>⚠️ <strong>Atenção:</strong> Qualidade baixa - revise o texto extraído`;
    }
    
    // Redefinir botão
    processBtn.textContent = '✅ Processado';
    
    // Sugerir título baseado nas primeiras linhas (opcional)
    if (result.lines && result.lines.length > 0) {
      const titleField = document.getElementById('lesson-title-input');
      if (!titleField.value) {
        const suggestedTitle = result.lines[0].substring(0, 80);
        titleField.value = suggestedTitle;
      }
    }
    
  } catch (error) {
    statusDiv.style.background = '#fee2e2';
    statusDiv.style.color = '#991b1b';
    statusDiv.innerHTML = `❌ Erro: ${error.message}`;
    
    processBtn.disabled = false;
    processBtn.textContent = '🔍 Processar Imagens e Extrair Texto';
  }
}