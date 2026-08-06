import express from 'express';
import multer from 'multer';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { SpacedRepetitionSystem } from './spacedRepetition.js';
import { CategoryManager } from './categoryManager.js';
import { LessonManager } from './lessonManager.js';
import { enrichWithLLM, generateWithPrompt, generateQuickVocabulary, generateQuickVocabularyBatch, generateSentenceVocabulary } from './llmEnricher.js';
import { imageProcessor } from './imageProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// Configuração do multer para upload de imagens
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
    }
  }
});

const srs = new SpacedRepetitionSystem();
const categoryManager = new CategoryManager();
const lessonManager = new LessonManager();

function normalizeToken(value) {
  return String(value || '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s'-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAnkiInputType(text) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return 'unknown';
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasSentencePunctuation = /[.!?]$/.test(normalized);

  if (wordCount === 1) {
    return 'word';
  }

  if (wordCount <= 5 && !hasSentencePunctuation) {
    return 'chunk';
  }

  return 'sentence';
}

function parseAnkiTermsInput(text) {
  const rawText = String(text || '').trim();
  if (!rawText) {
    return [];
  }

  const terms = rawText
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^[-*\s]+/, '').trim())
    .filter(Boolean);

  const seen = new Set();
  const unique = [];

  for (const term of terms) {
    const normalized = normalizeToken(term);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(term);
  }

  return unique;
}

function ensureAnkiCategory() {
  const existing = categoryManager.getCategory('anki');
  if (existing) {
    return existing;
  }

  return categoryManager.createCategory({
    id: 'anki',
    name: 'Anki',
    description: 'Cadastro rápido de vocabulário com IA',
    icon: '⚡',
    color: '#0F766E',
    type: 'language',
    ttsLang: 'en-US',
    ttsRate: 0.9
  });
}

ensureAnkiCategory();

// ============================================
// API ENDPOINTS
// ============================================

// ============================================
// ANKI RÁPIDO
// ============================================

/**
 * GET /api/anki/lessons - Lista aulas da categoria anki
 */
app.get('/api/anki/lessons', (req, res) => {
  try {
    ensureAnkiCategory();
    const lessons = lessonManager.listLessons('anki');
    res.json({ categoryId: 'anki', lessons });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/anki/preview - Gera tradução e exemplos para uma palavra
 */
app.post('/api/anki/preview', async (req, res) => {
  try {
    const word = (req.body?.word || '').trim();
    if (!word) {
      return res.status(400).json({ error: 'Termo ou frase é obrigatório' });
    }

    if (word.length > 500) {
      return res.status(400).json({ error: 'Texto muito longo (máximo 500 caracteres)' });
    }

    const parsedTerms = parseAnkiTermsInput(word);

    if (parsedTerms.length > 1) {
      const batchItems = await generateQuickVocabularyBatch(parsedTerms);
      if (!batchItems.length) {
        return res.status(422).json({ error: 'Não foi possível gerar conteúdo para os termos informados.' });
      }

      const preview = {
        ...batchItems[0],
        batchItems,
        sourceInput: word
      };

      return res.json({
        preview,
        inputType: 'word-list',
        batchSize: batchItems.length
      });
    }

    const preview = await generateQuickVocabulary(word);
    const inputType = getAnkiInputType(word);
    res.json({ preview, inputType, batchSize: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/anki/save - Salva palavra em aula existente ou cria nova aula
 */
app.post('/api/anki/save', async (req, res) => {
  try {
    ensureAnkiCategory();

    const payload = req.body || {};
    const preview = payload.preview || {};
    const word = (preview.word || '').trim();
    const translation = (preview.translation || '').trim();
    const batchItems = Array.isArray(preview.batchItems)
      ? preview.batchItems
          .filter((item) => item?.word)
          .map((item) => ({
            word: String(item.word || '').trim(),
            translation: String(item.translation || '').trim(),
            definition: String(item.definition || '').trim(),
            examples: Array.isArray(item.examples) ? item.examples : [],
            pronunciation: String(item.pronunciation || '').trim(),
            partOfSpeech: String(item.partOfSpeech || 'other').trim() || 'other',
            synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
            difficulty: String(item.difficulty || 'intermediate').trim() || 'intermediate'
          }))
          .filter((item) => item.word && item.translation)
      : [];
    const isBatchInput = batchItems.length > 1;
    const inputType = isBatchInput ? 'word-list' : getAnkiInputType(word);

    if (!isBatchInput && (!word || !translation)) {
      return res.status(400).json({ error: 'word e translation são obrigatórios' });
    }

    let lessonId = payload.lessonId;
    const shouldCreateLesson = !lessonId;

    if (shouldCreateLesson) {
      const today = new Date().toISOString().slice(0, 10);
      const lessonDate = (payload.newLessonDate || today).trim();
      const lessonTitle = (payload.newLessonTitle || `Anki ${lessonDate}`).trim();

      const createdLesson = lessonManager.createLesson('anki', {
        date: lessonDate,
        title: lessonTitle,
        rawContent: 'Cadastro rápido via Anki'
      });

      lessonId = createdLesson.id;
    }

    const existingLesson = lessonManager.getLesson('anki', lessonId);
    if (!existingLesson) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }

    const existingVocab = existingLesson.enriched?.vocabulary || [];
    const existingQuestions = existingLesson.enriched?.practiceQuestions || [];
    const existingVocabularyMap = new Map(
      existingVocab.map((item) => [normalizeToken(item.word), true])
    );

    let updatedLesson = existingLesson;
    let addedVocabularyCount = 0;
    let addedQuestion = false;

    if (inputType === 'sentence') {
      const normalizedSentence = normalizeToken(word);
      const hasDuplicateQuestion = existingQuestions.some((q) => normalizeToken(q.question) === normalizedSentence);

      if (!hasDuplicateQuestion) {
        updatedLesson = lessonManager.addQuestion('anki', lessonId, {
          type: 'translation',
          question: word,
          answer: translation,
          explanation: preview.definition || '',
          sourceType: 'sentence',
          sourceText: word
        });
        addedQuestion = true;
      }

      // Derivar vocabulário da frase e inserir apenas itens inéditos.
      const derivedVocabulary = [];
      try {
        const aiDerived = await generateSentenceVocabulary(word, 8);
        derivedVocabulary.push(...aiDerived);
      } catch (error) {
        console.warn('Falha ao derivar vocabulário da frase via IA:', error.message);
      }

      for (const item of derivedVocabulary) {
        const normalizedItemWord = normalizeToken(item.word);
        if (!normalizedItemWord || existingVocabularyMap.has(normalizedItemWord)) {
          continue;
        }

        updatedLesson = lessonManager.addVocabulary('anki', lessonId, {
          ...item,
          sourceType: 'derived-from-sentence',
          sourceText: word
        });
        existingVocabularyMap.set(normalizedItemWord, true);
        addedVocabularyCount++;
      }

      if (!addedQuestion && addedVocabularyCount === 0) {
        return res.status(409).json({
          error: 'A frase e as palavras derivadas já existem nesta aula.',
          code: 'DUPLICATE_SENTENCE',
          lessonId
        });
      }
    } else if (isBatchInput) {
      const addedWords = [];
      const skippedWords = [];

      for (const item of batchItems) {
        const normalizedWord = normalizeToken(item.word);
        if (!normalizedWord) {
          continue;
        }

        if (existingVocabularyMap.has(normalizedWord)) {
          skippedWords.push(item.word);
          continue;
        }

        updatedLesson = lessonManager.addVocabulary('anki', lessonId, {
          word: item.word,
          translation: item.translation,
          definition: item.definition || '',
          examples: Array.isArray(item.examples) ? item.examples : [],
          pronunciation: item.pronunciation || '',
          partOfSpeech: item.partOfSpeech || 'other',
          synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
          difficulty: item.difficulty || 'intermediate',
          sourceType: 'word-list',
          sourceText: preview.sourceInput || batchItems.map((entry) => entry.word).join(', ')
        });

        existingVocabularyMap.set(normalizedWord, true);
        addedWords.push(item.word);
        addedVocabularyCount++;
      }

      if (addedVocabularyCount === 0) {
        return res.status(409).json({
          error: 'Nenhum termo novo foi salvo: todos já existem nesta aula.',
          code: 'DUPLICATE_WORD_LIST',
          lessonId,
          skippedWords
        });
      }

      return res.status(201).json({
        success: true,
        lessonId,
        createdLesson: shouldCreateLesson,
        inputType,
        addedQuestion,
        addedVocabularyCount,
        addedWords,
        skippedWords,
        totalVocabulary: updatedLesson.enriched?.vocabulary?.length || 0,
        totalQuestions: updatedLesson.enriched?.practiceQuestions?.length || 0
      });
    } else {
      const normalizedWord = normalizeToken(word);
      const hasDuplicateWord = existingVocabularyMap.has(normalizedWord);

      if (hasDuplicateWord) {
        return res.status(409).json({
          error: `O termo "${word}" já existe nesta aula.`,
          code: 'DUPLICATE_WORD',
          lessonId
        });
      }

      updatedLesson = lessonManager.addVocabulary('anki', lessonId, {
        word,
        translation,
        definition: preview.definition || '',
        examples: Array.isArray(preview.examples) ? preview.examples : [],
        pronunciation: preview.pronunciation || '',
        partOfSpeech: preview.partOfSpeech || (inputType === 'chunk' ? 'expression' : 'other'),
        synonyms: Array.isArray(preview.synonyms) ? preview.synonyms : [],
        difficulty: preview.difficulty || 'intermediate',
        sourceType: inputType,
        sourceText: word
      });
      addedVocabularyCount = 1;
    }

    res.status(201).json({
      success: true,
      lessonId,
      createdLesson: shouldCreateLesson,
      inputType,
      addedQuestion,
      addedVocabularyCount,
      totalVocabulary: updatedLesson.enriched?.vocabulary?.length || 0,
      totalQuestions: updatedLesson.enriched?.practiceQuestions?.length || 0
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// CATEGORIAS
// ============================================

/**
 * GET /api/categories - Lista todas as categorias
 */
app.get('/api/categories', (req, res) => {
  try {
    const categories = categoryManager.listCategories();
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/categories - Cria nova categoria
 */
app.post('/api/categories', (req, res) => {
  try {
    const category = categoryManager.createCategory(req.body);
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/categories/:id - Obtém uma categoria específica
 */
app.get('/api/categories/:id', (req, res) => {
  try {
    const category = categoryManager.getCategory(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/categories/:categoryId/tips - Retorna dicas cadastradas da categoria
 */
app.get('/api/categories/:categoryId/tips', (req, res) => {
  try {
    const category = categoryManager.getCategory(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    const tipsPath = join(config.getCategoryPaths(req.params.categoryId).processed, 'tips.json');

    if (!existsSync(tipsPath)) {
      return res.json({ categoryId: req.params.categoryId, tips: {} });
    }

    const rawData = readFileSync(tipsPath, 'utf-8');
    const tips = JSON.parse(rawData);
    res.json({ categoryId: req.params.categoryId, tips });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar dicas da categoria' });
  }
});

// ============================================
// AULAS (com suporte a categorias)
// ============================================

/**
 * GET /api/categories/:categoryId/lessons - Lista aulas de uma categoria
 */
app.get('/api/categories/:categoryId/lessons', (req, res) => {
  try {
    const lessons = lessonManager.listLessons(req.params.categoryId);
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar índice de aulas' });
  }
});

/**
 * POST /api/categories/:categoryId/lessons - Cria nova aula
 */
app.post('/api/categories/:categoryId/lessons', (req, res) => {
  try {
    const lesson = lessonManager.createLesson(req.params.categoryId, req.body);
    res.status(201).json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/categories/:categoryId/lessons/:id - Obtém aula específica
 */
app.get('/api/categories/:categoryId/lessons/:id', (req, res) => {
  try {
    const lesson = lessonManager.getLesson(req.params.categoryId, req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }
    res.json(lesson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/categories/:categoryId/lessons/:id - Atualiza aula
 */
app.put('/api/categories/:categoryId/lessons/:id', (req, res) => {
  try {
    const lesson = lessonManager.updateLesson(req.params.categoryId, req.params.id, req.body);
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/categories/:categoryId/lessons/:id - Deleta aula
 */
app.delete('/api/categories/:categoryId/lessons/:id', (req, res) => {
  try {
    const result = lessonManager.deleteLesson(req.params.categoryId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /api/categories/:categoryId/lessons/:id/vocabulary - Adiciona vocabulário
 */
app.post('/api/categories/:categoryId/lessons/:id/vocabulary', (req, res) => {
  try {
    const lesson = lessonManager.addVocabulary(req.params.categoryId, req.params.id, req.body);
    res.status(201).json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/categories/:categoryId/lessons/:id/questions - Adiciona questão
 */
app.post('/api/categories/:categoryId/lessons/:id/questions', (req, res) => {
  try {
    const lesson = lessonManager.addQuestion(req.params.categoryId, req.params.id, req.body);
    res.status(201).json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/categories/:categoryId/lessons/:id/enrich - Enriquece aula com IA
 */
app.post('/api/categories/:categoryId/lessons/:id/enrich', async (req, res) => {
  try {
    const lesson = lessonManager.getLesson(req.params.categoryId, req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }

    // Buscar categoria para determinar tipo de enriquecimento
    const category = categoryManager.getCategory(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Enriquecer com IA
    const enrichedLesson = await enrichWithLLM(lesson, category);

    // Salvar aula enriquecida
    const updatedLesson = lessonManager.updateLesson(
      req.params.categoryId,
      req.params.id,
      enrichedLesson
    );

    res.json(updatedLesson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/categories/:categoryId/lessons/:id/generate - Gera conteúdo com prompt customizado
 */
app.post('/api/categories/:categoryId/lessons/:id/generate', upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 1 }
]), async (req, res) => {
  try {
    // Support both JSON body and multipart form data
    const prompt = req.body.prompt;
    const imageFiles = [
      ...((req.files && req.files.images) || []),
      ...((req.files && req.files.image) || [])
    ];

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt é obrigatório' });
    }

    if (prompt.length > 5000) {
      return res.status(400).json({ error: 'Prompt muito longo (máximo 5000 caracteres)' });
    }

    const lesson = lessonManager.getLesson(req.params.categoryId, req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }

    const category = categoryManager.getCategory(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Se houver imagens, converter para base64 para enviar junto ao prompt
    const imageInputs = imageFiles.map((file) => {
      console.log(`📸 Imagem recebida: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`);
      return {
        base64: file.buffer.toString('base64'),
        mimeType: file.mimetype
      };
    });

    // Gerar conteúdo com IA
    const generated = await generateWithPrompt(lesson, category, prompt.trim(), imageInputs);

    // Salvar conteúdo gerado atrelado à aula
    const existingGenerated = lesson.generatedContents || [];
    existingGenerated.push({
      id: `gen-${Date.now()}`,
      ...generated
    });

    const updatedLesson = lessonManager.updateLesson(
      req.params.categoryId,
      req.params.id,
      { generatedContents: existingGenerated }
    );

    res.json({
      success: true,
      generated: generated,
      totalGenerated: existingGenerated.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/categories/:categoryId/ocr - Processa múltiplas imagens com OCR
 */
app.post('/api/categories/:categoryId/ocr', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    // Verificar se categoria existe
    const category = categoryManager.getCategory(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    console.log(`\n📸 Processando OCR para categoria: ${category.name} (${req.files.length} imagem(ns))`);

    // Salvar temporariamente os arquivos
    const uploadsDir = join(__dirname, '..', 'data', 'temp');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    const tempFiles = [];
    for (const file of req.files) {
      console.log(`   Arquivo: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);
      const tempFilePath = join(uploadsDir, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}-${file.originalname}`);
      writeFileSync(tempFilePath, file.buffer);
      tempFiles.push(tempFilePath);
    }

    try {
      // Processar cada imagem com OCR e concatenar resultados
      const allTexts = [];
      const allLines = [];
      let totalConfidence = 0;
      let worstQuality = 'excellent';
      let ocrModel = null;
      let ocrProvider = null;
      const qualityOrder = { excellent: 3, good: 2, fair: 1, poor: 0 };

      for (let i = 0; i < tempFiles.length; i++) {
        console.log(`\n🔍 OCR imagem ${i + 1}/${tempFiles.length}...`);
        const ocrResult = await imageProcessor.extractTextFromImage(tempFiles[i]);

        if (!ocrResult.success) {
          console.warn(`⚠️ Imagem ${i + 1} falhou: ${ocrResult.error}`);
          continue;
        }

        allTexts.push(ocrResult.text);
        allLines.push(...ocrResult.lines);
        totalConfidence += ocrResult.confidence;
        ocrModel = ocrResult.metadata?.model || ocrModel;
        ocrProvider = ocrResult.metadata?.provider || ocrProvider;

        if (qualityOrder[ocrResult.quality] < qualityOrder[worstQuality]) {
          worstQuality = ocrResult.quality;
        }
      }

      if (allTexts.length === 0) {
        return res.status(400).json({
          error: 'OCR processing failed',
          details: 'No text could be extracted from any image'
        });
      }

      const combinedText = allTexts.join('\n\n---\n\n');
      const avgConfidence = totalConfidence / allTexts.length;

      console.log(`\n✅ OCR concluído: ${allLines.length} linhas de ${allTexts.length} imagem(ns)`);

      res.json({
        success: true,
        text: combinedText,
        lines: allLines,
        confidence: avgConfidence,
        quality: worstQuality,
        imageCount: allTexts.length,
        metadata: {
          lineCount: allLines.length,
          characterCount: combinedText.length,
          model: ocrModel || (config.llm.provider === 'foundry' ? config.foundryOpenAI.deployment : config.azureOpenAI.deployment),
          provider: ocrProvider || config.llm.provider
        }
      });

    } finally {
      // Limpar arquivos temporários
      for (const tempFile of tempFiles) {
        try {
          const { unlinkSync } = await import('fs');
          unlinkSync(tempFile);
        } catch (cleanupError) {
          console.warn('⚠️  Falha ao remover arquivo temporário:', cleanupError.message);
        }
      }
      console.log('🗑️  Arquivos temporários removidos');
    }

  } catch (error) {
    console.error('❌ Erro no endpoint de OCR:', error);
    res.status(500).json({
      error: 'OCR processing error',
      message: error.message
    });
  }
});

/**
 * GET /api/categories/:categoryId/study/today - Itens para estudar hoje
 */
app.get('/api/categories/:categoryId/study/today', (req, res) => {
  try {
    const allItems = getAllStudyItems(req.params.categoryId);
    const dueItems = srs.getItemsDueToday(allItems);
    res.json({
      count: dueItems.length,
      items: dueItems.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/categories/:categoryId/lessons/:lessonId/practice - Todos os itens de uma aula para prática
 */
app.get('/api/categories/:categoryId/lessons/:lessonId/practice', (req, res) => {
  try {
    const { categoryId, lessonId } = req.params;
    const paths = config.getCategoryPaths(categoryId);
    const lessonPath = join(paths.processed, `${lessonId}.json`);
    
    if (!existsSync(lessonPath)) {
      return res.status(404).json({ error: 'Aula não encontrada' });
    }
    
    const lesson = JSON.parse(readFileSync(lessonPath, 'utf-8'));
    const items = [];
    
    // Buscar categoria para determinar tipo
    const category = categoryManager.getCategory(categoryId);
    const categoryType = category?.type || 'language';
    
    if (lesson.enriched) {
      if (categoryType === 'technology') {
        // Itens de categorias de tecnologia
        
        // Conceitos
        if (lesson.enriched.concepts) {
          lesson.enriched.concepts.forEach(item => {
            items.push({
              ...item,
              lessonId: lesson.id,
              lessonDate: lesson.date,
              category: 'concept'
            });
          });
        }
        
        // Exercícios
        if (lesson.enriched.exercises) {
          lesson.enriched.exercises.forEach(item => {
            items.push({
              ...item,
              lessonId: lesson.id,
              lessonDate: lesson.date,
              category: 'exercise'
            });
          });
        }
        
        // Comandos
        if (lesson.enriched.commands) {
          lesson.enriched.commands.forEach(item => {
            items.push({
              ...item,
              lessonId: lesson.id,
              lessonDate: lesson.date,
              category: 'command'
            });
          });
        }
        
        // Cenários
        if (lesson.enriched.scenarios) {
          lesson.enriched.scenarios.forEach(item => {
            items.push({
              ...item,
              lessonId: lesson.id,
              lessonDate: lesson.date,
              category: 'scenario'
            });
          });
        }
        
        // Keywords como flashcards
        if (lesson.enriched.keywords) {
          lesson.enriched.keywords.forEach(item => {
            items.push({
              ...item,
              lessonId: lesson.id,
              lessonDate: lesson.date,
              category: 'keyword'
            });
          });
        }
      } else {
        // Itens de categorias de idioma
        
        // Vocabulário
        if (lesson.enriched.vocabulary) {
          lesson.enriched.vocabulary.forEach(item => {
            items.push({
              ...item,
              lessonId: lesson.id,
              lessonDate: lesson.date,
              category: 'vocabulary'
            });
          });
        }
        
        // Gramática
        if (lesson.enriched.grammar) {
          lesson.enriched.grammar.forEach(item => {
            items.push({
              ...item,
              lessonId: lesson.id,
              lessonDate: lesson.date,
              category: 'grammar'
            });
          });
        }
        
        // Expressões
        if (lesson.enriched.expressions) {
          lesson.enriched.expressions.forEach(item => {
            items.push({
              ...item,
              lessonId: lesson.id,
              lessonDate: lesson.date,
              category: 'expression'
            });
          });
        }
      }
      
      // Questões práticas (comum a todos os tipos)
      if (lesson.enriched.practiceQuestions) {
        lesson.enriched.practiceQuestions.forEach(item => {
          items.push({
            ...item,
            lessonId: lesson.id,
            lessonDate: lesson.date,
            category: 'question'
          });
        });
      }
    }
    
    res.json({
      lessonTitle: lesson.title,
      lessonDate: lesson.date,
      count: items.length,
      items: items
    });
  } catch (error) {
    console.error('Erro ao buscar itens da aula:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/categories/:categoryId/study/review - Registra revisão
 */
app.post('/api/categories/:categoryId/study/review', (req, res) => {
  try {
    const { itemId, quality, lessonId } = req.body;
    const paths = config.getCategoryPaths(req.params.categoryId);
    
    // Carregar aula
    const lessonPath = join(paths.processed, `${lessonId}.json`);
    const lesson = JSON.parse(readFileSync(lessonPath, 'utf-8'));
    
    // Buscar categoria para determinar tipo
    const category = categoryManager.getCategory(req.params.categoryId);
    const categoryType = category?.type || 'language';
    
    // Encontrar e atualizar item
    let updated = false;
    
    // Categorias para buscar baseado no tipo
    const categoriesToSearch = categoryType === 'technology'
      ? ['concepts', 'exercises', 'commands', 'scenarios']
      : ['vocabulary', 'practiceQuestions', 'grammar'];
    
    categoriesToSearch.forEach(category => {
      if (lesson.enriched?.[category]) {
        const itemIndex = lesson.enriched[category].findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
          const item = lesson.enriched[category][itemIndex];
          const srsData = item.spacedRepetition || srs.initializeItem();
          lesson.enriched[category][itemIndex].spacedRepetition = srs.reviewItem(srsData, quality);
          updated = true;
        }
      }
    });
    
    if (updated) {
      writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), 'utf-8');
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Item não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/categories/:categoryId/stats - Estatísticas de uma categoria
 */
app.get('/api/categories/:categoryId/stats', (req, res) => {
  try {
    const allItems = getAllStudyItems(req.params.categoryId);
    const stats = srs.getStatistics(allItems);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENDPOINTS LEGADOS (compatibilidade com inglês)
// ============================================

/**
 * GET /api/lessons - Lista todas as aulas (categoria inglês)
 */
app.get('/api/lessons', (req, res) => {
  try {
    const indexPath = join(config.paths.processed, 'index.json');
    const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
    res.json(index);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar índice de aulas' });
  }
});

/**
 * GET /api/lessons/:id - Obtém uma aula específica
 */
app.get('/api/lessons/:id', (req, res) => {
  try {
    const lessonPath = join(config.paths.processed, `${req.params.id}.json`);
    const lesson = JSON.parse(readFileSync(lessonPath, 'utf-8'));
    res.json(lesson);
  } catch (error) {
    res.status(404).json({ error: 'Aula não encontrada' });
  }
});

/**
 * GET /api/study/today - Obtém itens para estudar hoje
 */
app.get('/api/study/today', (req, res) => {
  try {
    const allItems = getAllStudyItems();
    const dueItems = srs.getItemsDueToday(allItems);
    res.json({
      count: dueItems.length,
      items: dueItems.slice(0, 20) // Limitar a 20 itens por sessão
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/study/review - Registra uma revisão
 */
app.post('/api/study/review', (req, res) => {
  try {
    const { itemId, quality, lessonId } = req.body;
    
    // Carregar aula
    const lessonPath = join(config.paths.processed, `${lessonId}.json`);
    const lesson = JSON.parse(readFileSync(lessonPath, 'utf-8'));
    
    // Encontrar e atualizar item
    let updated = false;
    
    ['vocabulary', 'practiceQuestions', 'grammar'].forEach(category => {
      if (lesson.enriched?.[category]) {
        const itemIndex = lesson.enriched[category].findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
          const item = lesson.enriched[category][itemIndex];
          const srsData = item.spacedRepetition || srs.initializeItem();
          lesson.enriched[category][itemIndex].spacedRepetition = srs.reviewItem(srsData, quality);
          updated = true;
        }
      }
    });
    
    if (updated) {
      // Salvar aula atualizada
      writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), 'utf-8');
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Item não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats - Obtém estatísticas gerais
 */
app.get('/api/stats', (req, res) => {
  try {
    const allItems = getAllStudyItems();
    const stats = srs.getStatistics(allItems);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Obtém todos os itens de estudo de todas as aulas
 * @param {string} categoryId - ID da categoria (padrão: 'ingles')
 */
function getAllStudyItems(categoryId = 'ingles') {
  const items = [];
  
  try {
    const paths = config.getCategoryPaths(categoryId);
    const files = readdirSync(paths.processed)
      .filter(f => f.startsWith('lesson-') && f.endsWith('.json'));
    
    // Buscar categoria para determinar tipo
    const category = categoryManager.getCategory(categoryId);
    const categoryType = category?.type || 'language';
    
    files.forEach(file => {
      const lessonPath = join(paths.processed, file);
      const lesson = JSON.parse(readFileSync(lessonPath, 'utf-8'));
      
      if (lesson.enriched) {
        if (categoryType === 'technology') {
          // Itens de categorias de tecnologia
          
          // Adicionar conceitos
          if (lesson.enriched.concepts) {
            lesson.enriched.concepts.forEach(item => {
              items.push({
                ...item,
                lessonId: lesson.id,
                lessonDate: lesson.date,
                category: 'concept'
              });
            });
          }
          
          // Adicionar exercícios
          if (lesson.enriched.exercises) {
            lesson.enriched.exercises.forEach(item => {
              items.push({
                ...item,
                lessonId: lesson.id,
                lessonDate: lesson.date,
                category: 'exercise'
              });
            });
          }
          
          // Adicionar comandos
          if (lesson.enriched.commands) {
            lesson.enriched.commands.forEach(item => {
              items.push({
                ...item,
                lessonId: lesson.id,
                lessonDate: lesson.date,
                category: 'command'
              });
            });
          }
          
          // Adicionar cenários
          if (lesson.enriched.scenarios) {
            lesson.enriched.scenarios.forEach(item => {
              items.push({
                ...item,
                lessonId: lesson.id,
                lessonDate: lesson.date,
                category: 'scenario'
              });
            });
          }
          
        } else {
          // Itens de categorias de idioma
          
          // Adicionar vocabulário
          if (lesson.enriched.vocabulary) {
            lesson.enriched.vocabulary.forEach(item => {
              items.push({
                ...item,
                lessonId: lesson.id,
                lessonDate: lesson.date,
                category: 'vocabulary'
              });
            });
          }
          
          // Adicionar questões
          if (lesson.enriched.practiceQuestions) {
            lesson.enriched.practiceQuestions.forEach(item => {
              items.push({
                ...item,
                lessonId: lesson.id,
                lessonDate: lesson.date,
                category: 'question'
              });
            });
          }
          
          // Adicionar gramática
          if (lesson.enriched.grammar) {
            lesson.enriched.grammar.forEach(item => {
              items.push({
                ...item,
                lessonId: lesson.id,
                lessonDate: lesson.date,
                category: 'grammar'
              });
            });
          }
          
          // Adicionar expressões
          if (lesson.enriched.expressions) {
            lesson.enriched.expressions.forEach(item => {
              items.push({
                ...item,
                lessonId: lesson.id,
                lessonDate: lesson.date,
                category: 'expression'
              });
            });
          }
        }
      }
    });
  } catch (error) {
    console.error('Erro ao carregar itens:', error);
  }
  
  return items;
}

// ============================================
// START SERVER
// ============================================

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📚 Acesse http://localhost:${PORT} para começar a estudar!`);
});
