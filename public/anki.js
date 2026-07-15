const els = {
  wordInput: document.getElementById('word-input'),
  previewBtn: document.getElementById('preview-btn'),
  previewError: document.getElementById('preview-error'),
  previewNote: document.getElementById('preview-note'),
  previewPanel: document.getElementById('preview-panel'),
  savePanel: document.getElementById('save-panel'),
  previewWord: document.getElementById('preview-word'),
  previewTranslation: document.getElementById('preview-translation'),
  previewPos: document.getElementById('preview-pos'),
  previewDifficulty: document.getElementById('preview-difficulty'),
  previewDefinition: document.getElementById('preview-definition'),
  previewExamples: document.getElementById('preview-examples'),
  lessonSelect: document.getElementById('lesson-select'),
  newLessonTitle: document.getElementById('new-lesson-title'),
  newLessonDate: document.getElementById('new-lesson-date'),
  saveBtn: document.getElementById('save-btn'),
  saveFeedback: document.getElementById('save-feedback'),
  existingLessonBox: document.getElementById('existing-lesson-box'),
  newLessonBox: document.getElementById('new-lesson-box'),
  batchPanel: document.getElementById('batch-panel'),
  batchItemsBody: document.getElementById('batch-items-body')
};

let currentPreview = null;

document.addEventListener('DOMContentLoaded', async () => {
  els.newLessonDate.value = new Date().toISOString().slice(0, 10);
  bindEvents();
  await loadLessons();
});

function bindEvents() {
  els.previewBtn.addEventListener('click', generatePreview);
  els.saveBtn.addEventListener('click', saveWord);

  document.querySelectorAll('input[name="lesson-mode"]').forEach((radio) => {
    radio.addEventListener('change', handleLessonMode);
  });
}

async function loadLessons(preferredLessonId = null) {
  const response = await fetch('/api/anki/lessons');
  const data = await response.json();
  const lessons = data.lessons || [];

  if (!lessons.length) {
    els.lessonSelect.innerHTML = '<option value="">Nenhuma aula ainda</option>';
    document.querySelector('input[name="lesson-mode"][value="new"]').checked = true;
    handleLessonMode();
    return;
  }

  const sortedLessons = lessons
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((lesson) => `<option value="${lesson.id}">${lesson.date} - ${lesson.title}</option>`)
    .join('');

  els.lessonSelect.innerHTML = sortedLessons;

  if (preferredLessonId) {
    const existsInCombo = Array.from(els.lessonSelect.options).some((opt) => opt.value === preferredLessonId);
    if (existsInCombo) {
      els.lessonSelect.value = preferredLessonId;
    }
  }
}

function handleLessonMode() {
  const mode = document.querySelector('input[name="lesson-mode"]:checked').value;
  const useNew = mode === 'new';

  els.existingLessonBox.hidden = useNew;
  els.newLessonBox.hidden = !useNew;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBatchItems(items) {
  if (!Array.isArray(items) || items.length <= 1) {
    els.batchPanel.hidden = true;
    els.batchItemsBody.innerHTML = '';
    return;
  }

  const rows = items
    .slice(1)
    .map((item, idx) => {
      const index = idx + 2;
      const originalIndex = idx + 1;
      const examplesText = Array.isArray(item.examples) ? item.examples.join('\n') : '';
      const synonymsText = Array.isArray(item.synonyms) ? item.synonyms.join(', ') : '';
      return `
        <div class="batch-item" data-original-index="${originalIndex}">
          <div class="batch-item-head">Termo ${index}</div>

          <div class="batch-grid">
            <div>
              <label>Palavra</label>
              <input class="batch-word" type="text" value="${escapeHtml(item.word || '')}">
            </div>

            <div>
              <label>Tradução</label>
              <input class="batch-translation" type="text" value="${escapeHtml(item.translation || '')}">
            </div>

            <div>
              <label>Classe gramatical</label>
              <input class="batch-pos" type="text" value="${escapeHtml(item.partOfSpeech || 'other')}">
            </div>

            <div>
              <label>Dificuldade</label>
              <select class="batch-difficulty">
                <option value="basic" ${item.difficulty === 'basic' ? 'selected' : ''}>basic</option>
                <option value="intermediate" ${!item.difficulty || item.difficulty === 'intermediate' ? 'selected' : ''}>intermediate</option>
                <option value="advanced" ${item.difficulty === 'advanced' ? 'selected' : ''}>advanced</option>
              </select>
            </div>

            <div class="batch-full">
              <label>Definição</label>
              <textarea class="batch-definition" rows="2">${escapeHtml(item.definition || '')}</textarea>
            </div>

            <div class="batch-full">
              <label>Exemplos (1 por linha)</label>
              <textarea class="batch-examples" rows="3">${escapeHtml(examplesText)}</textarea>
            </div>

            <div>
              <label>Pronúncia</label>
              <input class="batch-pronunciation" type="text" value="${escapeHtml(item.pronunciation || '')}">
            </div>

            <div>
              <label>Sinônimos (separados por vírgula)</label>
              <input class="batch-synonyms" type="text" value="${escapeHtml(synonymsText)}">
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  els.batchItemsBody.innerHTML = rows;
  els.batchPanel.hidden = false;
}

function syncBatchItemsFromForm() {
  if (!Array.isArray(currentPreview?.batchItems) || currentPreview.batchItems.length <= 1) {
    return;
  }

  const updatedBatch = [...currentPreview.batchItems];
  const rows = els.batchItemsBody.querySelectorAll('.batch-item');

  rows.forEach((row) => {
    const rowIndex = Number(row.getAttribute('data-original-index'));
    if (!Number.isFinite(rowIndex) || !updatedBatch[rowIndex]) {
      return;
    }

    const wordInput = row.querySelector('.batch-word');
    const translationInput = row.querySelector('.batch-translation');
    const definitionInput = row.querySelector('.batch-definition');
    const examplesInput = row.querySelector('.batch-examples');
    const partOfSpeechInput = row.querySelector('.batch-pos');
    const difficultyInput = row.querySelector('.batch-difficulty');
    const pronunciationInput = row.querySelector('.batch-pronunciation');
    const synonymsInput = row.querySelector('.batch-synonyms');

    const examples = String(examplesInput?.value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const synonyms = String(synonymsInput?.value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    updatedBatch[rowIndex] = {
      ...updatedBatch[rowIndex],
      word: (wordInput?.value || '').trim(),
      translation: (translationInput?.value || '').trim(),
      definition: (definitionInput?.value || '').trim(),
      examples,
      partOfSpeech: (partOfSpeechInput?.value || '').trim() || 'other',
      difficulty: (difficultyInput?.value || '').trim() || 'intermediate',
      pronunciation: (pronunciationInput?.value || '').trim(),
      synonyms
    };
  });

  currentPreview.batchItems = updatedBatch;
}

function readPreviewFromForm() {
  syncBatchItemsFromForm();

  const examples = els.previewExamples.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const preview = {
    word: els.previewWord.value.trim(),
    translation: els.previewTranslation.value.trim(),
    definition: els.previewDefinition.value.trim(),
    examples,
    pronunciation: '',
    partOfSpeech: els.previewPos.value.trim() || 'other',
    synonyms: [],
    difficulty: els.previewDifficulty.value
  };

  if (Array.isArray(currentPreview?.batchItems) && currentPreview.batchItems.length > 1) {
    const normalizedBatch = currentPreview.batchItems.map((item, index) => {
      if (index === 0) {
        return {
          ...item,
          ...preview
        };
      }
      return item;
    });

    preview.batchItems = normalizedBatch;
    preview.sourceInput = currentPreview.sourceInput || '';
  }

  return preview;
}

function writePreviewToForm(preview) {
  els.previewWord.value = preview.word || '';
  els.previewTranslation.value = preview.translation || '';
  els.previewPos.value = preview.partOfSpeech || '';
  els.previewDifficulty.value = preview.difficulty || 'intermediate';
  els.previewDefinition.value = preview.definition || '';
  els.previewExamples.value = Array.isArray(preview.examples) ? preview.examples.join('\n') : '';
}

function updateSaveButtonLabel() {
  const hasBatch = Array.isArray(currentPreview?.batchItems) && currentPreview.batchItems.length > 1;
  els.saveBtn.textContent = hasBatch ? 'Salvar Termos' : 'Salvar Palavra';
}

async function generatePreview() {
  const word = els.wordInput.value.trim();

  els.previewError.hidden = true;
  els.previewError.textContent = '';
  els.previewNote.hidden = true;
  els.previewNote.textContent = '';
  els.previewBtn.disabled = true;
  els.previewBtn.textContent = 'Gerando...';

  try {
    if (!word) {
      throw new Error('Digite um termo ou frase antes de gerar');
    }

    const response = await fetch('/api/anki/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao gerar com IA');
    }

    currentPreview = data.preview;
    writePreviewToForm(currentPreview);
    renderBatchItems(currentPreview?.batchItems || []);
    updateSaveButtonLabel();

    if ((data.batchSize || 1) > 1) {
      els.previewNote.hidden = false;
      els.previewNote.textContent = `Foram detectados ${data.batchSize} termos. Revise os campos abaixo: todos serão salvos.`;
    }

    els.previewPanel.hidden = false;
    els.savePanel.hidden = false;
  } catch (error) {
    els.previewError.hidden = false;
    els.previewError.textContent = error.message;
  } finally {
    els.previewBtn.disabled = false;
    els.previewBtn.textContent = 'Gerar com IA';
  }
}

async function saveWord() {
  const mode = document.querySelector('input[name="lesson-mode"]:checked').value;
  const preview = readPreviewFromForm();
  const selectedLessonBeforeSave = mode === 'existing' ? els.lessonSelect.value : null;
  const hasBatch = Array.isArray(preview.batchItems) && preview.batchItems.length > 1;

  if (hasBatch) {
    preview.batchItems = preview.batchItems.filter((item) => item?.word && item?.translation);
    if (!preview.batchItems.length) {
      els.saveFeedback.hidden = false;
      els.saveFeedback.textContent = 'Preencha ao menos um termo com tradução na lista.';
      return;
    }
  } else if (!preview.word || !preview.translation) {
    els.saveFeedback.hidden = false;
    els.saveFeedback.textContent = 'Preencha pelo menos palavra e tradução.';
    return;
  }

  const payload = {
    preview,
    lessonId: mode === 'existing' ? els.lessonSelect.value : null,
    newLessonTitle: mode === 'new' ? els.newLessonTitle.value.trim() : null,
    newLessonDate: mode === 'new' ? els.newLessonDate.value : null
  };

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = 'Salvando...';

  try {
    const response = await fetch('/api/anki/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao salvar palavra');
    }

    els.saveFeedback.hidden = false;
    if (data.inputType === 'sentence') {
      const lessonInfo = data.createdLesson ? 'em uma nova aula' : 'na aula selecionada';
      const details = [];
      if (data.addedQuestion) {
        details.push('frase adicionada em exercícios');
      }
      if (data.addedVocabularyCount > 0) {
        details.push(`${data.addedVocabularyCount} palavra(s) adicionada(s) ao vocabulário`);
      }
      els.saveFeedback.textContent = `Frase salva com sucesso ${lessonInfo}: ${details.join(' + ')}.`;
    } else if (data.inputType === 'word-list') {
      const skippedCount = Array.isArray(data.skippedWords) ? data.skippedWords.length : 0;
      const summary = skippedCount > 0
        ? `${data.addedVocabularyCount} termo(s) novo(s) salvo(s); ${skippedCount} já existiam.`
        : `${data.addedVocabularyCount} termo(s) salvo(s) com sucesso.`;
      els.saveFeedback.textContent = summary;
    } else {
      els.saveFeedback.textContent = data.createdLesson
        ? 'Termo salvo com sucesso em uma nova aula.'
        : 'Termo salvo com sucesso na aula selecionada.';
    }

    const lessonToKeepSelected = data.lessonId || selectedLessonBeforeSave;
    await loadLessons(lessonToKeepSelected);

    if (mode === 'new' && data.createdLesson) {
      document.querySelector('input[name="lesson-mode"][value="existing"]').checked = true;
      handleLessonMode();
    }
  } catch (error) {
    els.saveFeedback.hidden = false;
    els.saveFeedback.textContent = error.message;
  } finally {
    els.saveBtn.disabled = false;
    updateSaveButtonLabel();
  }
}
