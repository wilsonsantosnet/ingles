const els = {
  wordInput: document.getElementById('word-input'),
  previewBtn: document.getElementById('preview-btn'),
  previewError: document.getElementById('preview-error'),
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
  newLessonBox: document.getElementById('new-lesson-box')
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

function readPreviewFromForm() {
  const examples = els.previewExamples.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    word: els.previewWord.value.trim(),
    translation: els.previewTranslation.value.trim(),
    definition: els.previewDefinition.value.trim(),
    examples,
    pronunciation: '',
    partOfSpeech: els.previewPos.value.trim() || 'other',
    synonyms: [],
    difficulty: els.previewDifficulty.value
  };
}

function writePreviewToForm(preview) {
  els.previewWord.value = preview.word || '';
  els.previewTranslation.value = preview.translation || '';
  els.previewPos.value = preview.partOfSpeech || '';
  els.previewDifficulty.value = preview.difficulty || 'intermediate';
  els.previewDefinition.value = preview.definition || '';
  els.previewExamples.value = Array.isArray(preview.examples) ? preview.examples.join('\n') : '';
}

async function generatePreview() {
  const word = els.wordInput.value.trim();

  els.previewError.hidden = true;
  els.previewError.textContent = '';
  els.previewBtn.disabled = true;
  els.previewBtn.textContent = 'Gerando...';

  try {
    if (!word) {
      throw new Error('Digite uma palavra antes de gerar');
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

  if (!preview.word || !preview.translation) {
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
    els.saveFeedback.textContent = data.createdLesson
      ? 'Palavra salva com sucesso em uma nova aula.'
      : 'Palavra salva com sucesso na aula selecionada.';

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
    els.saveBtn.textContent = 'Salvar Palavra';
  }
}
