import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';
import { SpacedRepetitionSystem } from './spacedRepetition.js';

/**
 * Gerenciador de Aulas (CRUD)
 */
export class LessonManager {
  constructor() {
    this.srs = new SpacedRepetitionSystem();
  }

  /**
   * Gera o próximo ID disponível para uma data específica
   * Permite múltiplas aulas no mesmo dia: lesson-2026-03-18-1, lesson-2026-03-18-2, etc.
   * Compatível com aulas existentes no formato antigo (lesson-YYYY-MM-DD.json sem índice)
   * @param {string} categoryId - ID da categoria
   * @param {string} date - Data no formato YYYY-MM-DD
   * @returns {string} ID único para a aula
   */
  generateNextLessonId(categoryId, date) {
    try {
      const paths = config.getCategoryPaths(categoryId);
      
      // Verificar se a pasta existe
      if (!existsSync(paths.processed)) {
        return `lesson-${date}-1`;
      }
      
      // Listar todos os arquivos na pasta
      const files = readdirSync(paths.processed);
      const normalizedDate = date.replace(/\//g, '-');
      
      // Verificar se existe aula no formato antigo (sem índice)
      const legacyFile = `lesson-${normalizedDate}.json`;
      const hasLegacyLesson = files.includes(legacyFile);
      
      // Filtrar aulas da mesma data com índice numérico
      const pattern = new RegExp(`^lesson-${normalizedDate}-(\\d+)\\.json$`);
      const existingIndices = files
        .filter(file => pattern.test(file))
        .map(file => {
          const match = file.match(pattern);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(idx => idx > 0);
      
      // Se existe aula antiga OU aulas indexadas, determinar próximo índice
      if (hasLegacyLesson || existingIndices.length > 0) {
        // Considerar aula antiga como índice "1" se não houver lesson-DATE-1.json
        const startIndex = hasLegacyLesson && !existingIndices.includes(1) ? 2 : 1;
        const maxIndex = existingIndices.length > 0 ? Math.max(...existingIndices) : 0;
        const nextIndex = Math.max(startIndex, maxIndex + 1);
        return `lesson-${normalizedDate}-${nextIndex}`;
      }
      
      // Primeira aula nesta data
      return `lesson-${normalizedDate}-1`;
    } catch (error) {
      console.error('Erro ao gerar ID da aula:', error);
      // Fallback: usar timestamp
      return `lesson-${date}-${Date.now()}`;
    }
  }

  /**
   * Lista todas as aulas de uma categoria
   * @param {string} categoryId - ID da categoria
   * @returns {Array} Lista de aulas
   */
  listLessons(categoryId) {
    try {
      const paths = config.getCategoryPaths(categoryId);
      const indexPath = paths.index;
      
      if (!existsSync(indexPath)) {
        return [];
      }
      
      const data = readFileSync(indexPath, 'utf-8');
      const index = JSON.parse(data);
      return index.lessons || [];
    } catch (error) {
      console.error('Erro ao listar aulas:', error);
      return [];
    }
  }

  /**
   * Obtém uma aula específica
   * @param {string} categoryId - ID da categoria
   * @param {string} lessonId - ID da aula
   * @returns {Object|null} Aula encontrada ou null
   */
  getLesson(categoryId, lessonId) {
    try {
      const paths = config.getCategoryPaths(categoryId);
      const lessonPath = join(paths.processed, `${lessonId}.json`);
      
      if (!existsSync(lessonPath)) {
        return null;
      }
      
      const data = readFileSync(lessonPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Erro ao obter aula:', error);
      return null;
    }
  }

  /**
   * Cria uma nova aula
   * @param {string} categoryId - ID da categoria
   * @param {Object} lessonData - Dados da aula
   * @returns {Object} Aula criada
   */
  createLesson(categoryId, lessonData) {
    // Validar campos obrigatórios
    if (!lessonData.date || !lessonData.title) {
      throw new Error('Campos obrigatórios: date, title');
    }

    // Gerar ID único com indexador (permite múltiplas aulas no mesmo dia)
    const lessonId = this.generateNextLessonId(categoryId, lessonData.date);
    const paths = config.getCategoryPaths(categoryId);
    const lessonPath = join(paths.processed, `${lessonId}.json`);

    // Criar estrutura da aula
    const lesson = {
      id: lessonId,
      date: lessonData.date,
      title: lessonData.title,
      categoryId: categoryId,
      source: 'manual',
      rawContent: lessonData.rawContent || '',
      enriched: this.initializeEnrichedContent(lessonData),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'created'
    };
    
    // Determinar status baseado no conteúdo enriched
    const hasVocab = lesson.enriched.vocabulary && lesson.enriched.vocabulary.length > 0;
    const hasQuestions = lesson.enriched.practiceQuestions && lesson.enriched.practiceQuestions.length > 0;
    const hasGrammar = lesson.enriched.grammar && lesson.enriched.grammar.length > 0;
    
    if (hasVocab || hasQuestions || hasGrammar) {
      lesson.status = 'enriched';
    }

    // Adicionar dados de SRS aos itens
    if (lesson.enriched.vocabulary) {
      lesson.enriched.vocabulary = lesson.enriched.vocabulary.map((item, idx) => ({
        ...item,
        id: item.id || `vocab-${lessonId}-${idx}`,
        spacedRepetition: this.srs.initializeItem()
      }));
    }

    if (lesson.enriched.practiceQuestions) {
      lesson.enriched.practiceQuestions = lesson.enriched.practiceQuestions.map((item, idx) => ({
        ...item,
        id: item.id || `question-${lessonId}-${idx}`,
        spacedRepetition: this.srs.initializeItem()
      }));
    }

    if (lesson.enriched.grammar) {
      lesson.enriched.grammar = lesson.enriched.grammar.map((item, idx) => ({
        ...item,
        id: item.id || `grammar-${lessonId}-${idx}`,
        spacedRepetition: this.srs.initializeItem()
      }));
    }

    // Salvar aula
    writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), 'utf-8');

    // Atualizar índice
    this.updateIndex(categoryId, {
      id: lessonId,
      date: lesson.date,
      title: lesson.title,
      status: lesson.status,
      file: 'manual'
    }, 'add');

    return lesson;
  }

  /**
   * Atualiza uma aula existente
   * @param {string} categoryId - ID da categoria
   * @param {string} lessonId - ID da aula
   * @param {Object} updates - Dados para atualizar
   * @returns {Object} Aula atualizada
   */
  updateLesson(categoryId, lessonId, updates) {
    const paths = config.getCategoryPaths(categoryId);
    const lessonPath = join(paths.processed, `${lessonId}.json`);

    if (!existsSync(lessonPath)) {
      throw new Error(`Aula ${lessonId} não encontrada`);
    }

    // Carregar aula existente
    const lesson = JSON.parse(readFileSync(lessonPath, 'utf-8'));

    // Não permitir alterar ID e data
    delete updates.id;
    delete updates.date;
    delete updates.createdAt;
    delete updates.categoryId;

    // Atualizar campos
    const updatedLesson = {
      ...lesson,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Determinar status baseado no conteúdo enriched
    if (updates.enriched) {
      const hasVocab = updates.enriched.vocabulary && updates.enriched.vocabulary.length > 0;
      const hasQuestions = updates.enriched.practiceQuestions && updates.enriched.practiceQuestions.length > 0;
      const hasGrammar = updates.enriched.grammar && updates.enriched.grammar.length > 0;
      
      if (hasVocab || hasQuestions || hasGrammar) {
        updatedLesson.status = 'enriched';
      }
    }

    // Se atualizou vocabulário/questões, garantir IDs e SRS
    if (updates.enriched) {
      if (updates.enriched.vocabulary) {
        updatedLesson.enriched.vocabulary = updates.enriched.vocabulary.map((item, idx) => {
          const existingItem = lesson.enriched?.vocabulary?.find(v => v.id === item.id);
          return {
            ...item,
            id: item.id || `vocab-${lessonId}-${idx}`,
            spacedRepetition: existingItem?.spacedRepetition || this.srs.initializeItem()
          };
        });
      }

      if (updates.enriched.practiceQuestions) {
        updatedLesson.enriched.practiceQuestions = updates.enriched.practiceQuestions.map((item, idx) => {
          const existingItem = lesson.enriched?.practiceQuestions?.find(q => q.id === item.id);
          return {
            ...item,
            id: item.id || `question-${lessonId}-${idx}`,
            spacedRepetition: existingItem?.spacedRepetition || this.srs.initializeItem()
          };
        });
      }

      if (updates.enriched.grammar) {
        updatedLesson.enriched.grammar = updates.enriched.grammar.map((item, idx) => {
          const existingItem = lesson.enriched?.grammar?.find(g => g.id === item.id);
          return {
            ...item,
            id: item.id || `grammar-${lessonId}-${idx}`,
            spacedRepetition: existingItem?.spacedRepetition || this.srs.initializeItem()
          };
        });
      }
    }

    // Salvar
    writeFileSync(lessonPath, JSON.stringify(updatedLesson, null, 2), 'utf-8');

    // Atualizar índice
    this.updateIndex(categoryId, {
      id: lessonId,
      date: updatedLesson.date,
      title: updatedLesson.title,
      status: updatedLesson.status,
      file: updatedLesson.file || 'manual'
    }, 'update');

    return updatedLesson;
  }

  /**
   * Deleta uma aula
   * @param {string} categoryId - ID da categoria
   * @param {string} lessonId - ID da aula
   */
  deleteLesson(categoryId, lessonId) {
    const paths = config.getCategoryPaths(categoryId);
    const lessonPath = join(paths.processed, `${lessonId}.json`);

    if (!existsSync(lessonPath)) {
      throw new Error(`Aula ${lessonId} não encontrada`);
    }

    // Deletar arquivo
    unlinkSync(lessonPath);

    // Atualizar índice
    this.updateIndex(categoryId, { id: lessonId }, 'remove');

    return { success: true, message: `Aula ${lessonId} deletada` };
  }

  /**
   * Adiciona item de vocabulário a uma aula
   * @param {string} categoryId - ID da categoria
   * @param {string} lessonId - ID da aula
   * @param {Object} vocabItem - Item de vocabulário
   * @returns {Object} Aula atualizada
   */
  addVocabulary(categoryId, lessonId, vocabItem) {
    const lesson = this.getLesson(categoryId, lessonId);
    if (!lesson) {
      throw new Error('Aula não encontrada');
    }

    if (!lesson.enriched) {
      lesson.enriched = {};
    }

    if (!lesson.enriched.vocabulary) {
      lesson.enriched.vocabulary = [];
    }

    const newItem = {
      ...vocabItem,
      id: `vocab-${lessonId}-${lesson.enriched.vocabulary.length}`,
      spacedRepetition: this.srs.initializeItem()
    };

    lesson.enriched.vocabulary.push(newItem);
    lesson.status = 'enriched';
    lesson.updatedAt = new Date().toISOString();

    const paths = config.getCategoryPaths(categoryId);
    const lessonPath = join(paths.processed, `${lessonId}.json`);
    writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), 'utf-8');

    this.updateIndex(categoryId, {
      id: lesson.id,
      date: lesson.date,
      title: lesson.title,
      status: lesson.status,
      file: lesson.file || 'manual'
    }, 'update');

    return lesson;
  }

  /**
   * Adiciona questão prática a uma aula
   * @param {string} categoryId - ID da categoria
   * @param {string} lessonId - ID da aula
   * @param {Object} question - Questão
   * @returns {Object} Aula atualizada
   */
  addQuestion(categoryId, lessonId, question) {
    const lesson = this.getLesson(categoryId, lessonId);
    if (!lesson) {
      throw new Error('Aula não encontrada');
    }

    if (!lesson.enriched) {
      lesson.enriched = {};
    }

    if (!lesson.enriched.practiceQuestions) {
      lesson.enriched.practiceQuestions = [];
    }

    const newItem = {
      ...question,
      id: `question-${lessonId}-${lesson.enriched.practiceQuestions.length}`,
      spacedRepetition: this.srs.initializeItem()
    };

    lesson.enriched.practiceQuestions.push(newItem);
    lesson.status = 'enriched';
    lesson.updatedAt = new Date().toISOString();

    const paths = config.getCategoryPaths(categoryId);
    const lessonPath = join(paths.processed, `${lessonId}.json`);
    writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), 'utf-8');

    this.updateIndex(categoryId, {
      id: lesson.id,
      date: lesson.date,
      title: lesson.title,
      status: lesson.status,
      file: lesson.file || 'manual'
    }, 'update');

    return lesson;
  }

  /**
   * Inicializa conteúdo enriquecido vazio ou com dados fornecidos
   */
  initializeEnrichedContent(data) {
    // Se os dados já vêm com a estrutura enriched, usar ela
    if (data.enriched) {
      return {
        summary: data.enriched.summary || '',
        mainTopics: data.enriched.mainTopics || [],
        vocabulary: data.enriched.vocabulary || [],
        practiceQuestions: data.enriched.practiceQuestions || [],
        grammar: data.enriched.grammar || [],
        expressions: data.enriched.expressions || [],
        culturalNotes: data.enriched.culturalNotes || [],
        supportMaterials: data.enriched.supportMaterials || []
      };
    }
    
    // Formato retrocompatível (dados diretamente no root)
    return {
      summary: data.summary || '',
      mainTopics: data.mainTopics || [],
      vocabulary: data.vocabulary || [],
      practiceQuestions: data.practiceQuestions || [],
      grammar: data.grammar || [],
      expressions: data.expressions || [],
      culturalNotes: data.culturalNotes || [],
      supportMaterials: data.supportMaterials || []
    };
  }

  /**
   * Atualiza o índice de aulas
   */
  updateIndex(categoryId, lessonData, operation) {
    const paths = config.getCategoryPaths(categoryId);
    const indexPath = paths.index;

    let index = { lessons: [] };
    if (existsSync(indexPath)) {
      index = JSON.parse(readFileSync(indexPath, 'utf-8'));
    }

    if (operation === 'add') {
      index.lessons.push(lessonData);
    } else if (operation === 'update') {
      const idx = index.lessons.findIndex(l => l.id === lessonData.id);
      if (idx !== -1) {
        index.lessons[idx] = { ...index.lessons[idx], ...lessonData };
      } else {
        // Auto-recupera entradas ausentes no índice para evitar aulas "sumidas" na listagem.
        index.lessons.push(lessonData);
      }
    } else if (operation === 'remove') {
      index.lessons = index.lessons.filter(l => l.id !== lessonData.id);
    }

    index.totalLessons = index.lessons.length;
    index.processedAt = new Date().toISOString();
    index.categoryId = categoryId;

    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
}
