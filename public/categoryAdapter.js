/**
 * Adaptador para lidar com diferentes tipos de categorias
 * Suporta: language (inglês) e technology (az-104, etc)
 */

class CategoryAdapter {
  constructor(category) {
    this.category = category;
    this.type = category?.type || 'language';
  }

  /** Gera botão TTS inline para um item */
  static ttsButton(text, size = '1rem') {
    const escaped = (text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `<button class="tts-btn" onclick="event.stopPropagation(); ttsSpeak('${escaped}')" title="Ouvir" style="font-size:${size}; cursor:pointer; background:none; border:none; padding:2px 4px; opacity:0.7; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">🔊</button>`;
  }

  /** Gera botão TTS para seção inteira */
  static ttsSectionButton(sectionId, label = 'Ouvir Tudo') {
    return `<button class="tts-btn tts-section-btn" onclick="event.stopPropagation(); ttsSpeakSection('${sectionId}')" title="${label}" style="font-size:0.85rem; cursor:pointer; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; padding:6px 14px; border-radius:16px; font-weight:600; transition:all 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🔊 ${label}</button>`;
  }

  /**
   * Formata enunciado de multipla escolha para quebrar linha entre opcoes (A, B, C...)
   */
  static formatMultipleChoiceQuestion(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();

    if (!/[A-Ha-h]\)/.test(normalized)) {
      return normalized;
    }

    return normalized.replace(/\s+([A-Ha-h]\))/g, '<br>$1');
  }

  /**
   * Retorna os campos disponíveis para o tipo de categoria
   */
  getAvailableFields() {
    if (this.type === 'technology') {
      return {
        basic: ['summary', 'mainTopics', 'rawContent'],
        enriched: ['summary', 'mainTopics', 'keywords', 'topics', 'resources', 'practiceQuestions']
      };
    }
    
    // language (padrão)
    return {
      basic: ['summary', 'mainTopics', 'rawContent'],
      enriched: ['summary', 'mainTopics', 'vocabulary', 'grammar', 'expressions', 'practiceQuestions']
    };
  }

  /**
   * Retorna estrutura de tabs para o editor
   */
  getEditorTabs() {
    if (this.type === 'technology') {
      return [
        { id: 'basic', label: '📝 Básico', icon: '📝' },
        { id: 'keywords', label: '🔑 Termos', icon: '🔑' },
        { id: 'topics', label: '📚 Tópicos', icon: '📚' },
        { id: 'questions', label: '❓ Exercícios', icon: '❓' },
        { id: 'materials', label: '🔗 Materiais de Apoio', icon: '🔗' }
      ];
    }
    
    // language
    return [
      { id: 'basic', label: '📝 Básico', icon: '📝' },
      { id: 'vocabulary', label: '📚 Vocabulário', icon: '📚' },
      { id: 'grammar', label: '📖 Gramática', icon: '📖' },
      { id: 'questions', label: '❓ Exercícios', icon: '❓' },
      { id: 'materials', label: '🔗 Materiais de Apoio', icon: '🔗' }
    ];
  }

  /**
   * Inicializa estrutura de dados vazia para uma nova aula
   */
  getEmptyLessonData() {
    const base = {
      date: '',
      title: '',
      rawContent: '',
      enriched: {
        summary: '',
        mainTopics: [],
        practiceQuestions: [],
        supportMaterials: []
      }
    };

    if (this.type === 'technology') {
      base.enriched.keywords = [];
      base.enriched.topics = [];
      base.enriched.resources = [];
    } else {
      base.enriched.vocabulary = [];
      base.enriched.grammar = [];
      base.enriched.expressions = [];
    }

    return base;
  }

  /**
   * Formata detalhes da aula para visualização
   */
  formatLessonDetails(lesson) {
    const enriched = lesson.enriched;
    
    if (!enriched) {
      return '<p class="error">Aula não foi enriquecida ainda.</p>';
    }
    
    let html = `
      <div class="lesson-section">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <h4 style="margin:0;">📝 Resumo</h4>
          ${CategoryAdapter.ttsButton(enriched.summary || '', '1.1rem')}
        </div>
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

    if (this.type === 'technology') {
      html += this.formatTechnologyContent(enriched);
    } else {
      html += this.formatLanguageContent(enriched);
    }

    // Materiais de Apoio (comum a todos os tipos)
    if (enriched.supportMaterials && enriched.supportMaterials.length > 0) {
      const typeIcons = {
        video: '🎥',
        pdf: '📄',
        document: '📝',
        link: '🔗'
      };
      
      html += `
        <div class="lesson-section">
          <h4>🔗 Materiais de Apoio (${enriched.supportMaterials.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${enriched.supportMaterials.map(material => `
              <a href="${material.url}" target="_blank" rel="noopener noreferrer" 
                 style="display: flex; align-items: center; gap: 12px; padding: 12px; 
                        background: linear-gradient(135deg, #f8fafc, #f1f5f9); 
                        border: 2px solid #e2e8f0; border-radius: 10px; 
                        text-decoration: none; color: inherit; transition: all 0.3s ease;"
                 onmouseover="this.style.borderColor='#667eea'; this.style.transform='translateX(4px)';"
                 onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateX(0)';">
                <span style="font-size: 1.8rem;">${typeIcons[material.type] || '🔗'}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                    ${material.title}
                  </div>
                  <div style="font-size: 0.85rem; color: #64748b; word-break: break-all;">
                    ${material.url}
                  </div>
                </div>
                <span style="color: #667eea; font-size: 1.2rem;">↗</span>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Conteúdo AI gerado
    if (lesson.generatedContents && lesson.generatedContents.length > 0) {
      html += `
        <div class="lesson-section">
          <h4>🧠 Conteúdo AI (${lesson.generatedContents.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${lesson.generatedContents.map((item, idx) => {
              const content = item.generatedContent || item;
              let contentHtml = '';
              const contentId = 'ai-content-' + Math.random().toString(36).substr(2, 8);
              if (typeof content === 'string') {
                // Formata texto: converte \n em <br>, **bold** em <strong>
                const formatted = content
                  .replace(/\n/g, '<br>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                contentHtml = `<div style="line-height:1.7; color:#1f2937; font-size:0.95rem;">${formatted}</div>`;
              } else if (content && typeof content === 'object') {
                // Renderiza objeto como HTML formatado para leitura
                let parts = [];
                if (content.title) {
                  parts.push(`<h5 style="margin:0 0 8px 0; color:#5b21b6; font-size:1.1rem;">${content.title}</h5>`);
                }
                if (content.type) {
                  parts.push(`<span style="display:inline-block; background:#ede9fe; color:#6d28d9; padding:2px 10px; border-radius:12px; font-size:0.8rem; margin-bottom:10px;">${content.type}</span>`);
                }
                if (content.content) {
                  const formatted = content.content
                    .replace(/\\n/g, '\n')
                    .replace(/\n/g, '<br>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/(\d+)\.\s/g, '<br><strong>$1.</strong> ');
                  parts.push(`<div style="line-height:1.8; color:#1f2937; font-size:0.95rem; margin-top:8px;">${formatted}</div>`);
                }
                // Renderiza qualquer outro campo que não seja title/type/content
                Object.keys(content).forEach(key => {
                  if (!['title', 'type', 'content'].includes(key)) {
                    const val = typeof content[key] === 'object' ? JSON.stringify(content[key], null, 2) : content[key];
                    const formattedVal = String(val).replace(/\\n/g, '\n').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    parts.push(`<div style="margin-top:10px;"><strong style="color:#6d28d9; text-transform:capitalize;">${key}:</strong><div style="line-height:1.7; color:#374151; margin-top:4px;">${formattedVal}</div></div>`);
                  }
                });
                contentHtml = parts.join('');
              } else {
                contentHtml = `<p style="white-space:pre-wrap; margin:0;">${String(content)}</p>`;
              }
              const date = item.generatedAt ? new Date(item.generatedAt).toLocaleString('pt-BR') : '';
              return `
                <div style="background:linear-gradient(135deg, #faf5ff, #f3e8ff); border:2px solid #e9d5ff; border-radius:12px; padding:16px;">
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <div>
                      <strong style="color:#7c3aed;">Prompt:</strong>
                      <span style="color:#374151;">${item.userPrompt || ''}</span>
                    </div>
                    <button class="tts-btn" onclick="event.stopPropagation(); ttsReadElement('${contentId}')" title="Ouvir conteúdo" style="font-size:1.1rem; cursor:pointer; background:linear-gradient(135deg,#7c3aed,#a855f7); color:white; border:none; padding:6px 14px; border-radius:16px; font-weight:600; transition:all 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🔊 Ouvir</button>
                  </div>
                  <div id="${contentId}" style="margin-bottom:8px;">
                    ${contentHtml}
                  </div>
                  <div style="font-size:0.8rem; color:#9ca3af;">${date}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Botão de prática no final
    html += `
      <div class="lesson-section" style="text-align: center; padding: 30px 20px; border-top: 2px dashed #e2e8f0; margin-top: 20px;">
        <button onclick="startLessonPractice('${lesson.categoryId}', '${lesson.id}')" 
                class="btn-practice"
                style="background: linear-gradient(135deg, #667eea, #764ba2); 
                       color: white; 
                       border: none; 
                       padding: 16px 40px; 
                       border-radius: 12px; 
                       font-weight: 700; 
                       cursor: pointer; 
                       font-size: 1.1rem;
                       transition: all 0.3s ease;
                       box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);"
                onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 8px 16px rgba(102, 126, 234, 0.4)'"
                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 6px rgba(102, 126, 234, 0.2)'">
          ✏️ Fazer Exercícios desta Aula
        </button>
        <p style="margin-top: 12px; color: #64748b; font-size: 0.9rem;">
          Pratique todos os itens desta aula
        </p>
      </div>
    `;
    
    return html;
  }

  /**
   * Formata conteúdo específico de tecnologia
   */
  formatTechnologyContent(enriched) {
    let html = '';

    // Concepts
    if (enriched.concepts && enriched.concepts.length > 0) {
      html += `
        <div class="lesson-section">
          <h4>💡 Conceitos (${enriched.concepts.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${enriched.concepts.map(c => `
              <div style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px solid #bbf7d0; border-radius: 10px; padding: 14px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <strong style="color:#166534; font-size:1.05rem;">${c.concept}</strong>
                  ${c.difficulty ? `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:10px; font-size:0.75rem;">${c.difficulty}</span>` : ''}
                </div>
                <p style="margin:0 0 6px 0; color:#1f2937;">${c.definition || ''}</p>
                ${c.examples && c.examples.length > 0 ? `<div style="font-size:0.9rem; color:#374151;"><strong>Exemplos:</strong> ${c.examples.join(', ')}</div>` : ''}
                ${c.relatedConcepts && c.relatedConcepts.length > 0 ? `<div style="font-size:0.85rem; color:#6b7280; margin-top:4px;">Relacionados: ${c.relatedConcepts.join(', ')}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Keywords
    if (enriched.keywords && enriched.keywords.length > 0) {
      const kwSectionId = 'tts-kw-' + Math.random().toString(36).substr(2, 6);
      html += `
        <div class="lesson-section">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h4 style="margin:0;">🔑 Termos Técnicos (${enriched.keywords.length})</h4>
            ${CategoryAdapter.ttsSectionButton(kwSectionId, 'Ouvir Todos')}
          </div>
          <div class="vocab-grid" id="${kwSectionId}">
            ${enriched.keywords.slice(0, 10).map(item => `
              <div class="vocab-card-mini" data-tts-text="${(item.term || '').replace(/"/g, '&quot;')}">
                <div style="display:flex; align-items:center; gap:4px;">
                  <strong>${item.term}</strong>
                  ${CategoryAdapter.ttsButton(item.term, '0.9rem')}
                </div>
                <span class="translation">${item.definition ? item.definition.substring(0, 60) + '...' : '—'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Topics com URLs
    if (enriched.topics && enriched.topics.length > 0) {
      const topicSectionId = 'tts-topics-' + Math.random().toString(36).substr(2, 6);
      html += `
        <div class="lesson-section">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h4 style="margin:0;">📚 Tópicos (${enriched.topics.length})</h4>
            ${CategoryAdapter.ttsSectionButton(topicSectionId, 'Ouvir Todos')}
          </div>
          <div id="${topicSectionId}">
          ${enriched.topics.slice(0, 5).map(topic => `
            <div class="topic-item" data-tts-text="${(topic.title || '').replace(/"/g, '&quot;')}. ${(topic.description || '').replace(/"/g, '&quot;')}">
              <div style="display:flex; align-items:center; gap:6px;">
                <strong>${topic.title}</strong>
                ${CategoryAdapter.ttsButton(topic.title + (topic.description ? '. ' + topic.description : ''), '0.9rem')}
              </div>
              ${topic.description ? `<p>${topic.description}</p>` : ''}
              ${topic.urls && topic.urls.length > 0 ? `
                <div class="topic-links">
                  ${topic.urls.map(url => `<a href="${url.url}" target="_blank" class="topic-link">🔗 ${url.title}</a>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
          </div>
        </div>
      `;
    }

    // References/Links extraídos
    if (enriched.references && enriched.references.length > 0) {
      html += `
        <div class="lesson-section">
          <h4>🔗 Referências (${enriched.references.length})</h4>
          <div class="references-list">
            ${enriched.references.map(ref => `
              <div class="reference-item">
                <a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.title || ref.url}</a>
                ${ref.type ? `<span class="ref-type">${ref.type}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Scenarios
    if (enriched.scenarios && enriched.scenarios.length > 0) {
      html += `
        <div class="lesson-section">
          <h4>🎯 Cenários (${enriched.scenarios.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${enriched.scenarios.map(s => `
              <div style="background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 2px solid #fde68a; border-radius: 10px; padding: 14px;">
                <strong style="color:#92400e; font-size:1rem;">${s.scenario}</strong>
                <p style="margin:8px 0 4px 0; color:#1f2937;"><strong>Problema:</strong> ${s.problem}</p>
                <p style="margin:4px 0; color:#166534;"><strong>Solução:</strong> ${s.solution}</p>
                ${s.explanation ? `<p style="margin:4px 0 0 0; color:#6b7280; font-size:0.9rem;"><em>${s.explanation}</em></p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Exercises
    if (enriched.exercises && enriched.exercises.length > 0) {
      html += `
        <div class="lesson-section">
          <h4>✏️ Exercícios (${enriched.exercises.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${enriched.exercises.map((ex, idx) => {
              const exId = 'exercise-answer-' + Math.random().toString(36).substr(2, 8);
              return `
              <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 2px solid #93c5fd; border-radius: 10px; padding: 14px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <span style="background:#3b82f6; color:white; padding:2px 10px; border-radius:10px; font-size:0.8rem; font-weight:600;">${idx + 1}</span>
                  ${ex.type ? `<span style="background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:10px; font-size:0.75rem;">${ex.type}</span>` : ''}
                  ${ex.topic ? `<span style="color:#6b7280; font-size:0.8rem;">• ${ex.topic}</span>` : ''}
                </div>
                <p style="margin:0 0 8px 0; color:#1f2937; font-weight:500;">${ex.question}</p>
                ${ex.hint ? `<p style="margin:0 0 8px 0; color:#9ca3af; font-size:0.85rem;">💡 Dica: ${ex.hint}</p>` : ''}
                <button type="button" onclick="document.getElementById('${exId}').style.display = document.getElementById('${exId}').style.display === 'none' ? 'block' : 'none'"
                  style="background:#3b82f6; color:white; border:none; padding:6px 14px; border-radius:8px; font-size:0.85rem; cursor:pointer; font-weight:600;">
                  👁️ Ver Resposta
                </button>
                <div id="${exId}" style="display:none; margin-top:10px; padding:10px; background:#f0fdf4; border-radius:8px; border-left:4px solid #22c55e;">
                  <strong style="color:#166534;">Resposta:</strong>
                  <p style="margin:4px 0 0 0; color:#1f2937;">${ex.answer}</p>
                </div>
              </div>
            `;}).join('')}
          </div>
        </div>
      `;
    }

    // Exam Tips
    if (enriched.examTips && enriched.examTips.length > 0) {
      html += `
        <div class="lesson-section">
          <h4>🎓 Dicas para o Exame (${enriched.examTips.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${enriched.examTips.map(tip => `
              <div style="background: linear-gradient(135deg, #faf5ff, #f3e8ff); border-left: 4px solid #a855f7; border-radius: 0 10px 10px 0; padding: 12px 14px;">
                <p style="margin:0 0 4px 0; color:#1f2937; font-weight:500;">💡 ${tip.tip}</p>
                ${tip.relevance ? `<p style="margin:0; color:#6b7280; font-size:0.85rem;">${tip.relevance}</p>` : ''}
                ${tip.topic ? `<span style="font-size:0.8rem; color:#9ca3af;">📌 ${tip.topic}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Formata conteúdo específico de idiomas
   */
  formatLanguageContent(enriched) {
    let html = '';

    // Vocabulário
    if (enriched.vocabulary && enriched.vocabulary.length > 0) {
      const vocabSectionId = 'tts-vocab-' + Math.random().toString(36).substr(2, 6);
      html += `
        <div class="lesson-section">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h4 style="margin:0;">📚 Vocabulário (${enriched.vocabulary.length} palavras)</h4>
            ${CategoryAdapter.ttsSectionButton(vocabSectionId, 'Ouvir Todas')}
          </div>
          <div class="vocab-grid" id="${vocabSectionId}">
            ${enriched.vocabulary.slice(0, 10).map(item => `
              <div class="vocab-card-mini" data-tts-text="${(item.word || '').replace(/"/g, '&quot;')}">
                <div style="display:flex; align-items:center; gap:4px;">
                  <strong>${item.word}</strong>
                  ${CategoryAdapter.ttsButton(item.word, '0.9rem')}
                </div>
                <span class="translation">${item.translation || '—'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Gramática - com mais detalhes
    if (enriched.grammar && enriched.grammar.length > 0) {
      const grammarSectionId = 'tts-grammar-' + Math.random().toString(36).substr(2, 6);
      html += `<div class="lesson-section">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <h4 style="margin:0;">📖 Gramática (${enriched.grammar.length} tópicos)</h4>
          ${CategoryAdapter.ttsSectionButton(grammarSectionId, 'Ouvir Exemplos')}
        </div>
        <div id="${grammarSectionId}">`;
      
      enriched.grammar.forEach(g => {
        html += `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
            <h5 style="color: #f59e0b; margin-bottom: 10px;">${g.topic}</h5>
            ${g.explanation ? `<p style="margin-bottom: 10px;">${g.explanation}</p>` : ''}
            ${g.rules && g.rules.length > 0 ? `
              <p style="margin-top: 10px;"><strong>Regras:</strong></p>
              <ul style="margin-left: 20px;">
                ${g.rules.map(rule => `<li>${rule}</li>`).join('')}
              </ul>
            ` : ''}
            ${g.examples && g.examples.length > 0 ? `
              <p style="margin-top: 10px;"><strong>Exemplos:</strong></p>
              <ul style="margin-left: 20px;">
                ${g.examples.map(ex => `<li style="font-style: italic; color: #059669;" data-tts-text="${ex.replace(/"/g, '&quot;')}">${ex} ${CategoryAdapter.ttsButton(ex, '0.85rem')}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `;
      });
      
      html += `</div></div>`;
    }

    // Expressões idiomáticas
    if (enriched.expressions && enriched.expressions.length > 0) {
      const exprSectionId = 'tts-expr-' + Math.random().toString(36).substr(2, 6);
      html += `
        <div class="lesson-section">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h4 style="margin:0;">💬 Expressões Idiomáticas (${enriched.expressions.length})</h4>
            ${CategoryAdapter.ttsSectionButton(exprSectionId, 'Ouvir Todas')}
          </div>
          <div id="${exprSectionId}">
          ${enriched.expressions.map(exp => `
            <div style="background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 12px; margin-bottom: 10px; border-radius: 6px;" data-tts-text="${(exp.expression || '').replace(/"/g, '&quot;')}">
              <div style="display:flex; align-items:center; gap:6px;">
                <strong style="color: #0284c7;">${exp.expression}</strong>
                ${CategoryAdapter.ttsButton(exp.expression, '0.9rem')}
              </div>
              ${exp.meaning ? `<p style="margin-top: 5px;">${exp.meaning}</p>` : ''}
              ${exp.examples && exp.examples.length > 0 ? `
                <p style="margin-top: 5px; font-style: italic; color: #059669;">"${exp.examples[0]}" ${CategoryAdapter.ttsButton(exp.examples[0], '0.85rem')}</p>
              ` : ''}
            </div>
          `).join('')}
          </div>
        </div>
      `;
    }

    // Frases Originais da Aula
    if (enriched.originalExamples && enriched.originalExamples.length > 0) {
      const origSectionId = 'tts-orig-' + Math.random().toString(36).substr(2, 6);
      html += `
        <div class="lesson-section">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h4 style="margin:0;">📘 Frases Originais da Aula</h4>
            ${CategoryAdapter.ttsSectionButton(origSectionId, 'Ouvir Todas')}
          </div>
          <div id="${origSectionId}" style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
            ${enriched.originalExamples.map(example => `
              <p style="margin-bottom: 10px; padding: 8px; background: white; border-radius: 4px; line-height: 1.6; display:flex; align-items:center; gap:8px;" data-tts-text="${(example || '').replace(/"/g, '&quot;')}">
                <span style="flex:1;">${example}</span>
                ${CategoryAdapter.ttsButton(example, '0.9rem')}
              </p>
            `).join('')}
          </div>
        </div>
      `;
    }

    // References/Links extraídos
    if (enriched.references && enriched.references.length > 0) {
      html += `
        <div class="lesson-section">
          <h4>🔗 Referências (${enriched.references.length})</h4>
          <div class="references-list">
            ${enriched.references.map(ref => `
              <div class="reference-item">
                <a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.title || ref.url}</a>
                ${ref.type ? `<span class="ref-type">${ref.type}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Retorna os itens de estudo baseado no tipo
   */
  getStudyItemType(item) {
    if (!item.category) return 'unknown';
    
    // Mapeamento de categorias para tipos
    const typeMap = {
      'vocabulary': 'vocabulary',
      'concept': 'concept',
      'exercise': 'exercise',
      'command': 'command',
      'scenario': 'scenario',
      'keyword': 'keyword',
      'question': 'question',
      'grammar': 'grammar',
      'topic': 'topic',
      'expression': 'expression'
    };

    return typeMap[item.category] || 'general';
  }

  /**
   * Formata um card de estudo baseado no tipo
   */
  formatStudyCard(item) {
    const type = this.getStudyItemType(item);

    if (this.type === 'technology') {
      switch(type) {
        case 'concept':
          return {
            question: `<div style="display:flex; align-items:center; justify-content:center; gap:8px;"><h3 style="margin:0;">💡 ${item.concept}</h3>${CategoryAdapter.ttsButton(item.concept, '1.3rem')}</div>`,
            answer: `
              <p><strong>Definição:</strong> ${item.definition || 'N/A'}</p>
              ${item.examples && item.examples.length > 0 ? `
                <p style="margin-top: 10px;"><strong>Exemplos:</strong></p>
                <ul style="margin-left: 20px;">
                  ${item.examples.map(ex => `<li>${ex} ${CategoryAdapter.ttsButton(ex, '0.85rem')}</li>`).join('')}
                </ul>
              ` : ''}
              ${item.relatedConcepts && item.relatedConcepts.length > 0 ? `
                <p style="margin-top: 10px;"><strong>Relacionado:</strong> ${item.relatedConcepts.join(', ')}</p>
              ` : ''}
            `
          };
          
        case 'exercise':
          return {
            question: `<div style="display:flex; align-items:center; gap:8px;"><p style="flex:1; margin:0;">${item.question}</p>${CategoryAdapter.ttsButton(item.question, '1.1rem')}</div>`,
            answer: `
              <div style="display:flex; align-items:center; gap:8px;"><p style="flex:1; margin:0;"><strong>Resposta:</strong> ${item.answer || 'N/A'}</p>${item.answer ? CategoryAdapter.ttsButton(item.answer, '1rem') : ''}</div>
              ${item.hint ? `<p style="margin-top: 8px; color: #6b7280;"><strong>Dica:</strong> ${item.hint}</p>` : ''}
              ${item.topic ? `<p style="margin-top: 8px; color: #8b5cf6;"><strong>Tópico:</strong> ${item.topic}</p>` : ''}
            `
          };
          
        case 'command':
          return {
            question: `<div style="display:flex; align-items:center; justify-content:center; gap:8px;"><h3 style="margin:0;">⌨️ ${item.command}</h3>${CategoryAdapter.ttsButton(item.command, '1.3rem')}</div>`,
            answer: `
              <p><strong>Descrição:</strong> ${item.description || 'N/A'}</p>
              ${item.syntax ? `<pre style="background: #f3f4f6; padding: 10px; border-radius: 4px; margin-top: 10px; overflow-x: auto;">${item.syntax}</pre>` : ''}
              ${item.examples && item.examples.length > 0 ? `
                <p style="margin-top: 10px;"><strong>Exemplos:</strong></p>
                <ul style="margin-left: 20px;">
                  ${item.examples.map(ex => `<li><code>${ex}</code></li>`).join('')}
                </ul>
              ` : ''}
              ${item.platform ? `<p style="margin-top: 8px; color: #6b7280;"><strong>Plataforma:</strong> ${item.platform}</p>` : ''}
            `
          };
          
        case 'scenario':
          return {
            question: `<div style="display:flex; align-items:center; justify-content:center; gap:8px;"><h3 style="margin:0;">🎯 ${item.scenario}</h3>${CategoryAdapter.ttsButton(item.scenario, '1.3rem')}</div><p style="margin-top: 10px;"><strong>Problema:</strong> ${item.problem}</p>`,
            answer: `
              <div style="display:flex; align-items:center; gap:8px;"><p style="flex:1; margin:0;"><strong>Solução:</strong> ${item.solution || 'N/A'}</p>${item.solution ? CategoryAdapter.ttsButton(item.solution, '1rem') : ''}</div>
              ${item.explanation ? `<p style="margin-top: 10px; color: #6b7280;"><strong>Explicação:</strong> ${item.explanation}</p>` : ''}
            `
          };
        
        case 'keyword':
          return {
            question: `<div style="display:flex; align-items:center; justify-content:center; gap:8px;"><h3 style="margin:0;">${item.term}</h3>${CategoryAdapter.ttsButton(item.term, '1.3rem')}</div>`,
            answer: `
              <p><strong>Definição:</strong> ${item.definition || 'N/A'}</p>
              ${item.examples && item.examples.length > 0 ? `<p><strong>Exemplo:</strong> ${item.examples[0]}</p>` : ''}
            `
          };
        case 'question':
          return {
            question: `<div style="display:flex; align-items:center; gap:8px;"><p style="flex:1; margin:0;">${item.question}</p>${CategoryAdapter.ttsButton(item.question, '1.1rem')}</div>`,
            answer: `
              <div style="display:flex; align-items:center; gap:8px;"><p style="flex:1; margin:0;"><strong>Resposta:</strong> ${item.answer || 'N/A'}</p>${item.answer ? CategoryAdapter.ttsButton(item.answer, '1rem') : ''}</div>
              ${item.explanation ? `<p class="explanation">${item.explanation}</p>` : ''}
            `
          };
        default:
          return {
            question: `<p>${item.topic || item.title || 'Item de estudo'}</p>`,
            answer: `<p>${item.description || item.explanation || 'N/A'}</p>`
          };
      }
    }

    // Language (padrão)
    switch(type) {
      case 'vocabulary':
        let vocabAnswer = `<p style="color: #6b7280; font-style: italic; margin-bottom: 8px;">${item.partOfSpeech || ''}</p>`;
        vocabAnswer += `<p><strong>📖 Tradução</strong><br>${item.translation || 'N/A'}</p>`;
        
        if (item.pronunciation) {
          vocabAnswer += `<p style="margin-top: 10px;"><strong>🔊 Pronúncia</strong><br><span style="font-family: monospace; color: #667eea;">${item.pronunciation}</span></p>`;
        }
        
        if (item.definition) {
          vocabAnswer += `<p style="margin-top: 10px;"><strong>💬 Definição</strong><br>${item.definition}</p>`;
        }
        
        if (item.examples && item.examples.length > 0) {
          vocabAnswer += `<p style="margin-top: 10px;"><strong>📝 Exemplos</strong></p><ul style="margin-left: 20px;">`;
          vocabAnswer += item.examples.map(ex => `<li>${ex}</li>`).join('');
          vocabAnswer += `</ul>`;
        }
        
        if (item.synonyms && item.synonyms.length > 0) {
          vocabAnswer += `<p style="margin-top: 10px;"><strong>Sinônimos:</strong> ${item.synonyms.join(', ')}</p>`;
        }
        
        return {
          question: `<div style="display:flex; align-items:center; justify-content:center; gap:8px;"><h3 style="margin:0;">${item.word}</h3>${CategoryAdapter.ttsButton(item.word, '1.3rem')}</div>`,
          answer: vocabAnswer
        };
        
      case 'question':
        // Determinar tipo de exercício
        const exerciseType = item.type || 'translation';
        const displayQuestion = exerciseType === 'multiple-choice'
          ? CategoryAdapter.formatMultipleChoiceQuestion(item.question)
          : (item.question || '');
        const typeLabels = {
          'translation': '🌐 Tradução',
          'fill-in-blank': '✍️ Complete',
          'multiple-choice': '☑️ Múltipla Escolha',
          'grammar': '📖 Gramática'
        };
        
        // Formatação melhorada da pergunta
        let questionHTML = '<div class="question-exercise">';
        
        // Badge do tipo de exercício
        questionHTML += `<div class="exercise-type-badge">${typeLabels[exerciseType] || '❓ Exercício'}</div>`;
        
        // Badge do tempo verbal (se disponível) - mostrado como dica antes de responder
        if (item.tense) {
          questionHTML += `<div class="tense-badge" style="margin-bottom: 8px;">⏱️ ${item.tense}</div>`;
        }
        
        // Frase em inglês com destaque + botão TTS
        questionHTML += `<div class="english-sentence" style="display:flex; align-items:center; gap:8px;"><span style="flex:1;">${displayQuestion}</span>${CategoryAdapter.ttsButton(item.question, '1.1rem')}</div>`;
        
        // Área editável para tradução
        questionHTML += `
          <div class="translation-space">
            <textarea 
              id="user-answer-${item.id || 'temp'}" 
              class="user-answer-input"
              placeholder="✏️ Digite sua tradução aqui..."
              rows="3"
              style="width: 100%; 
                     padding: 16px; 
                     border: 2px solid #cbd5e1; 
                     border-radius: 8px; 
                     font-size: 1rem; 
                     font-family: inherit;
                     resize: vertical;
                     background: white;
                     transition: border-color 0.3s ease;"
              onfocus="this.style.borderColor='#667eea'"
              onblur="this.style.borderColor='#cbd5e1'"></textarea>
          </div>`;
        
        questionHTML += '</div>';
        
        // Formatação melhorada da resposta
        let answerHTML = '<div class="answer-section">';
        
        // Rótulo da resposta
        answerHTML += '<div class="answer-label">✅ Resposta Correta</div>';
        
        // Texto da resposta com TTS
        answerHTML += `<div class="answer-text" style="display:flex; align-items:center; gap:8px;"><span style="flex:1;">${item.answer || 'N/A'}</span>${item.answer ? CategoryAdapter.ttsButton(item.answer, '1rem') : ''}</div>`;
        
        // Explicação (se diferente da resposta)
        if (item.explanation && item.answer && item.explanation !== item.answer) {
          answerHTML += `<div class="answer-explanation">${item.explanation}</div>`;
        }
        
        answerHTML += '</div>';
        
        return {
          question: questionHTML,
          answer: answerHTML
        };
        
      case 'grammar':
        let grammarAnswer = '';
        
        if (item.explanation) {
          grammarAnswer += `<p><strong>Explicação:</strong><br>${item.explanation}</p>`;
        }
        
        if (item.rules && item.rules.length > 0) {
          grammarAnswer += `<p style="margin-top: 10px;"><strong>Regras:</strong></p><ul style="margin-left: 20px;">`;
          grammarAnswer += item.rules.map(rule => `<li>${rule}</li>`).join('');
          grammarAnswer += `</ul>`;
        }
        
        if (item.examples && item.examples.length > 0) {
          grammarAnswer += `<p style="margin-top: 10px;"><strong>Exemplos:</strong></p><ul style="margin-left: 20px;">`;
          grammarAnswer += item.examples.map(ex => `<li style="font-style: italic; color: #059669;">${ex}</li>`).join('');
          grammarAnswer += `</ul>`;
        }
        
        return {
          question: `<h3>${item.topic}</h3>`,
          answer: grammarAnswer
        };
        
      case 'expression':
        return {
          question: `<div style="display:flex; align-items:center; justify-content:center; gap:8px;"><h3 style="margin:0;">💬 ${item.expression}</h3>${CategoryAdapter.ttsButton(item.expression, '1.3rem')}</div>`,
          answer: `
            <p><strong>Significado:</strong> ${item.meaning || 'N/A'}</p>
            ${item.usage ? `<p style="margin-top: 8px;"><strong>Uso:</strong> ${item.usage}</p>` : ''}
            ${item.examples && item.examples.length > 0 ? `
              <p style="margin-top: 10px;"><strong>Exemplos:</strong></p>
              <ul style="margin-left: 20px;">
                ${item.examples.map(ex => `<li style="font-style: italic; color: #059669;">${ex}</li>`).join('')}
              </ul>
            ` : ''}
          `
        };
        
      default:
        return {
          question: `<p>${item.topic || item.question || item.word || item.expression || 'Item de estudo'}</p>`,
          answer: `<p>${item.explanation || item.answer || item.definition || item.meaning || 'N/A'}</p>`
        };
    }
  }

  /**
   * Retorna label de categoria para display
   */
  getCategoryLabel(category) {
    const labels = {
      'vocabulary': '📚 Vocabulário',
      'concept': '💡 Conceito',
      'exercise': '✏️ Exercício',
      'command': '⌨️ Comando',
      'scenario': '🎯 Cenário',
      'keyword': '🔑 Termo Técnico',
      'question': '❓ Exercício',
      'grammar': '📖 Gramática',
      'topic': '📚 Tópico',
      'expression': '💬 Expressão'
    };

    return labels[category] || '📝 Conteúdo';
  }
}

// Exportar para uso global
window.CategoryAdapter = CategoryAdapter;
