// Gerenciamento de Aulas
let currentCategory = null;
let currentLesson = null;

function isInvalidCategoryId(categoryId) {
  if (!categoryId) return true;
  const normalized = String(categoryId).trim();
  return (
    normalized.length === 0 ||
    normalized === 'null' ||
    normalized === 'undefined' ||
    normalized === '[object Object]'
  );
}

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  currentCategory = params.get('category');
  
  if (isInvalidCategoryId(currentCategory)) {
    alert('Categoria inválida ou não especificada. Voltando ao manager.');
    window.location.href = '/?manager';
    return;
  }
  
  const category = await loadCategoryInfo();
  if (!category) {
    alert('Categoria não encontrada. Voltando ao manager.');
    window.location.href = '/?manager';
    return;
  }

  await loadLessons();
  
  // Set default date to today
  document.getElementById('lesson-date').valueAsDate = new Date();
  
  // Form submission
  document.getElementById('lesson-form').addEventListener('submit', handleFormSubmit);
});

// Carregar informações da categoria
async function loadCategoryInfo() {
  try {
    const response = await fetch('/api/categories');
    const data = await response.json();
    const category = data.categories.find(c => c.id === currentCategory);
    
    if (category) {
      document.getElementById('category-title').textContent = `${category.icon} ${category.name}`;
      return category;
    }

    return null;
  } catch (error) {
    console.error('Erro ao carregar categoria:', error);
    return null;
  }
}

// Carregar lista de aulas
async function loadLessons() {
  const tbody = document.getElementById('lessons-tbody');
  
  try {
    const response = await fetch(`/api/categories/${encodeURIComponent(currentCategory)}/lessons`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const lessons = await response.json();
    
    console.log('Aulas carregadas:', lessons);
    console.log('Tipo de lessons:', Array.isArray(lessons) ? 'array' : typeof lessons);
    
    // Verificar se é array
    if (!Array.isArray(lessons)) {
      console.error('Resposta não é um array:', lessons);
      throw new Error('Formato de resposta inválido');
    }
    
    document.getElementById('lesson-count').textContent = 
      `${lessons.length} aula${lessons.length !== 1 ? 's' : ''}`;
    
    if (lessons.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: #6b7280;">
            Nenhuma aula encontrada. Clique em "Nova Aula" para começar.
          </td>
        </tr>
      `;
      return;
    }
    
    // Sort by date descending
    lessons.sort((a, b) => b.date.localeCompare(a.date));
    
    tbody.innerHTML = lessons.map(lesson => `
      <tr>
        <td>${formatDate(lesson.date)}</td>
        <td><strong>${escapeHtml(lesson.title)}</strong></td>
        <td><span class="status-badge status-${lesson.status || 'created'}">${getStatusLabel(lesson.status)}</span></td>
        <td>${getSourceLabel(lesson.file)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon btn-edit" onclick="window.location.href='/manage-full.html?category=${encodeURIComponent(currentCategory)}&lesson=${encodeURIComponent(lesson.id)}'" title="Editar Completo">
              ✏️
            </button>
            <button class="btn-icon btn-enrich" onclick="enrichLesson('${lesson.id}')" title="Enriquecer com IA">
              🤖
            </button>
            <button class="btn-icon" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:white;box-shadow:0 2px 8px rgba(139,92,246,0.3);" onclick="openAiModal('${lesson.id}', \`${lesson.title.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)" title="Gerar conteúdo com IA">
              🧠
            </button>
            <button class="btn-icon btn-delete" onclick="deleteLesson('${lesson.id}', \`${lesson.title.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)" title="Excluir">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    
    console.log('Tabela HTML gerada com sucesso');
  } catch (error) {
    console.error('Erro ao carregar aulas:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">
          Erro ao carregar aulas: ${error.message}
        </td>
      </tr>
    `;
  }
}

// Exibir modal de criação
function showCreateModal() {
  currentLesson = null;
  document.getElementById('modal-title').textContent = 'Nova Aula';
  document.getElementById('lesson-form').reset();
  document.getElementById('lesson-date').valueAsDate = new Date();
  document.getElementById('lesson-modal').style.display = 'block';
}

// Editar aula existente
async function editLesson(lessonId) {
  try {
    const response = await fetch(`/api/categories/${currentCategory}/lessons/${lessonId}`);
    const lesson = await response.json();
    
    currentLesson = lessonId;
    document.getElementById('modal-title').textContent = 'Editar Aula';
    document.getElementById('lesson-date').value = lesson.date;
    document.getElementById('lesson-title').value = lesson.title;
    document.getElementById('lesson-content').value = lesson.rawContent || '';
    document.getElementById('lesson-summary').value = lesson.summary || '';
    
    document.getElementById('lesson-modal').style.display = 'block';
  } catch (error) {
    alert(`Erro ao carregar aula: ${error.message}`);
  }
}

// Fechar modal
function closeModal() {
  document.getElementById('lesson-modal').style.display = 'none';
  currentLesson = null;
}

// Submeter formulário
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const saveBtn = document.getElementById('save-btn');
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="loading-spinner"></span> Salvando...';
  
  const formData = {
    date: document.getElementById('lesson-date').value,
    title: document.getElementById('lesson-title').value,
    rawContent: document.getElementById('lesson-content').value,
    summary: document.getElementById('lesson-summary').value
  };
  
  try {
    let response;
    if (currentLesson) {
      // Update
      response = await fetch(`/api/categories/${currentCategory}/lessons/${currentLesson}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } else {
      // Create
      response = await fetch(`/api/categories/${currentCategory}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao salvar aula');
    }
    
    closeModal();
    await loadLessons();
    alert(currentLesson ? 'Aula atualizada com sucesso!' : 'Aula criada com sucesso!');
  } catch (error) {
    alert(`Erro: ${error.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

// Enriquecer aula com IA
async function enrichLesson(lessonId) {
  if (!confirm('Deseja enriquecer esta aula com a IA? Isso adicionará vocabulário e perguntas automaticamente.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/categories/${currentCategory}/lessons/${lessonId}/enrich`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao enriquecer aula');
    }
    
    const result = await response.json();
    alert(`Aula enriquecida com sucesso!\n\nVocabulário: ${result.vocabularyCount} termos\nPerguntas: ${result.questionsCount} questões`);
    await loadLessons();
  } catch (error) {
    alert(`Erro ao enriquecer aula: ${error.message}`);
  }
}

// Excluir aula
async function deleteLesson(lessonId, title) {
  if (!confirm(`Tem certeza que deseja excluir a aula:\n\n"${title}"\n\nEsta ação não pode ser desfeita!`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/categories/${currentCategory}/lessons/${lessonId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao excluir aula');
    }
    
    await loadLessons();
    alert('Aula excluída com sucesso!');
  } catch (error) {
    alert(`Erro ao excluir aula: ${error.message}`);
  }
}

// Formatadores
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  });
}

function getStatusLabel(status) {
  const labels = {
    'created': 'Criada',
    'enriched': 'Enriquecida',
    'error': 'Erro'
  };
  return labels[status] || 'Criada';
}

function getSourceLabel(source) {
  const labels = {
    'manual': '✍️ Manual',
    'docx': '📄 Word',
    'imported': '📥 Importado'
  };
  return labels[source] || '📄 Word';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modal on outside click
window.onclick = function(event) {
  const modal = document.getElementById('lesson-modal');
  if (event.target === modal) {
    closeModal();
  }
  const aiModal = document.getElementById('ai-prompt-modal');
  if (event.target === aiModal) {
    closeAiModal();
  }
}

// ============================================
// AI PROMPT - Gerar conteúdo com IA
// ============================================
let aiTargetLessonId = null;
let aiSelectedImage = null;

function openAiModal(lessonId, lessonTitle) {
  aiTargetLessonId = lessonId;
  aiSelectedImage = null;
  document.getElementById('ai-modal-lesson-title').textContent = `Aula: ${lessonTitle}`;
  document.getElementById('ai-prompt-input').value = '';
  const resultDiv = document.getElementById('ai-result');
  resultDiv.style.display = 'none';
  resultDiv.classList.remove('is-error');
  resultDiv.innerHTML = '';
  document.getElementById('ai-image-preview').style.display = 'none';
  document.getElementById('ai-drop-content').style.display = 'block';
  document.getElementById('ai-image-input').value = '';
  const modal = document.getElementById('ai-prompt-modal');
  modal.classList.remove('maximized');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ai-modal-open');
  updateAiModalMaximizeButton();
}

function closeAiModal() {
  const modal = document.getElementById('ai-prompt-modal');
  modal.classList.remove('open', 'maximized');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('ai-modal-open');
  aiTargetLessonId = null;
  aiSelectedImage = null;
}

function toggleAiModalMaximize() {
  const modal = document.getElementById('ai-prompt-modal');
  if (!modal) {
    return;
  }

  modal.classList.toggle('maximized');
  updateAiModalMaximizeButton();
}

function updateAiModalMaximizeButton() {
  const modal = document.getElementById('ai-prompt-modal');
  const button = document.getElementById('ai-maximize-btn');
  if (!modal || !button) {
    return;
  }

  const isMaximized = modal.classList.contains('maximized');
  button.textContent = isMaximized ? '🗗' : '⛶';
  button.title = isMaximized ? 'Restaurar' : 'Maximizar';
  button.setAttribute('aria-label', button.title);
}

function handleAiImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
    alert('Formato inválido. Use JPEG ou PNG.');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    alert('Imagem muito grande. Máximo 20MB.');
    return;
  }
  aiSelectedImage = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('ai-preview-img').src = e.target.result;
    document.getElementById('ai-image-preview').style.display = 'block';
    document.getElementById('ai-drop-content').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearAiImage(event) {
  event.stopPropagation();
  aiSelectedImage = null;
  document.getElementById('ai-image-preview').style.display = 'none';
  document.getElementById('ai-drop-content').style.display = 'block';
  document.getElementById('ai-image-input').value = '';
}

// Drag and drop for AI modal
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('ai-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#667eea'; dropZone.style.background = '#f5f3ff'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#d1d5db'; dropZone.style.background = 'transparent'; });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#d1d5db';
      dropZone.style.background = 'transparent';
      const file = e.dataTransfer.files[0];
      if (file) {
        const input = document.getElementById('ai-image-input');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleAiImageSelect({ target: input });
      }
    });
  }

  // Suporte a Ctrl+V (paste) de imagem da área de transferência
  document.addEventListener('paste', (e) => {
    const modal = document.getElementById('ai-prompt-modal');
    if (!modal || !modal.classList.contains('open')) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          aiSelectedImage = file;
          const reader = new FileReader();
          reader.onload = (ev) => {
            document.getElementById('ai-preview-img').src = ev.target.result;
            document.getElementById('ai-image-preview').style.display = 'block';
            document.getElementById('ai-drop-content').style.display = 'none';
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  });
});

async function submitAiPrompt() {
  const prompt = document.getElementById('ai-prompt-input').value.trim();
  if (!prompt) {
    alert('Digite um prompt para a IA.');
    return;
  }

  const btn = document.getElementById('ai-generate-btn');
  const resultDiv = document.getElementById('ai-result');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Gerando...';
  resultDiv.style.display = 'none';
  resultDiv.classList.remove('is-error');
  resultDiv.innerHTML = '';

  try {
    let response;
    if (aiSelectedImage) {
      // Send with image as FormData
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('image', aiSelectedImage);
      response = await fetch(`/api/categories/${currentCategory}/lessons/${aiTargetLessonId}/generate`, {
        method: 'POST',
        body: formData
      });
    } else {
      // Send prompt only
      response = await fetch(`/api/categories/${currentCategory}/lessons/${aiTargetLessonId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao gerar conteúdo');
    }

    const data = await response.json();

    // Exibir resultado
    resultDiv.style.display = 'block';
    const content = data.generated?.generatedContent || data.generated;
    resultDiv.innerHTML = `
      <h4 class="ai-result-title">✅ Conteúdo gerado com sucesso!</h4>
      <div class="ai-result-scroll">
        <div class="ai-result-body">
          ${renderAiResult(content)}
        </div>
      </div>
      <p class="ai-result-meta">Total de conteúdos gerados nesta aula: ${data.totalGenerated}</p>
    `;
  } catch (error) {
    resultDiv.style.display = 'block';
    resultDiv.classList.add('is-error');
    resultDiv.innerHTML = `<p class="ai-result-empty">❌ Erro: ${escapeHtml(error.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Gerar';
  }
}

function renderAiResult(content) {
  if (typeof content === 'string') {
    return renderRichText(content);
  }

  if (!content || typeof content !== 'object') {
    return `<p>${escapeHtml(String(content))}</p>`;
  }

  const parts = [];

  if (content.title) {
    parts.push(`<h5>${escapeHtml(content.title)}</h5>`);
  }

  if (content.type) {
    parts.push(`<span class="ai-result-key">${escapeHtml(content.type)}</span>`);
  }

  if (content.content) {
    parts.push(renderStructuredContent(content.content));
  }

  Object.keys(content).forEach(key => {
    if (!['title', 'type', 'content'].includes(key)) {
      const value = typeof content[key] === 'object' ? JSON.stringify(content[key], null, 2) : String(content[key]);
      parts.push(`
        <section class="ai-result-content-card">
          <strong style="color:#6d28d9; text-transform:capitalize; display:block; margin-bottom:8px;">${escapeHtml(key)}:</strong>
          <div>${renderRichText(value)}</div>
        </section>
      `);
    }
  });

  return parts.join('');
}

function renderStructuredContent(content) {
  if (typeof content === 'string') {
    return renderRichText(content);
  }

  if (Array.isArray(content)) {
    return `
      <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
        ${content.map((item, index) => {
          if (item && typeof item === 'object') {
            return `
              <article class="ai-result-card">
                ${item.question ? `<div class="ai-result-question">${index + 1}. ${escapeHtml(item.question)}</div>` : ''}
                ${item.answer ? `<div class="ai-result-answer">✅ ${renderRichText(String(item.answer))}</div>` : ''}
                ${item.explanation ? `<div class="ai-result-explanation">💡 ${renderRichText(String(item.explanation))}</div>` : ''}
              </article>
            `;
          }

          return `<div class="ai-result-card">• ${renderRichText(String(item))}</div>`;
        }).join('')}
      </div>
    `;
  }

  if (typeof content === 'object') {
    return `<pre>${escapeHtml(JSON.stringify(content, null, 2))}</pre>`;
  }

  return renderRichText(String(content));
}

function renderRichText(value) {
  const normalized = String(value).replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks = [];
  let paragraph = [];
  let listMode = null;
  let listItems = [];
  let codeBlock = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${paragraph.join(' ').trim()}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listMode && listItems.length > 0) {
      const tag = listMode === 'ordered' ? 'ol' : 'ul';
      blocks.push(`<${tag}>${listItems.map(item => `<li>${item}</li>`).join('')}</${tag}>`);
    }
    listMode = null;
    listItems = [];
  };

  const flushCodeBlock = () => {
    if (codeBlock.length > 0) {
      blocks.push(`<pre>${escapeHtml(codeBlock.join('\n'))}</pre>`);
    }
    codeBlock = [];
  };

  lines.forEach(line => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushParagraph();
        flushList();
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeBlock.push(line);
      return;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length + 1;
      blocks.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch || orderedMatch) {
      flushParagraph();
      const mode = orderedMatch ? 'ordered' : 'unordered';
      if (listMode && listMode !== mode) {
        flushList();
      }
      listMode = mode;
      listItems.push(formatInline((bulletMatch || orderedMatch)[1]));
      return;
    }

    if (listMode) {
      flushList();
    }

    paragraph.push(formatInline(trimmed));
  });

  flushParagraph();
  flushList();
  if (inCodeBlock) {
    flushCodeBlock();
  }

  return blocks.join('');
}

function formatInline(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}
