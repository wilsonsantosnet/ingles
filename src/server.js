import express from 'express';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { SpacedRepetitionSystem } from './spacedRepetition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

const srs = new SpacedRepetitionSystem();

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /api/lessons - Lista todas as aulas
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
 */
function getAllStudyItems() {
  const items = [];
  
  try {
    const files = readdirSync(config.paths.processed)
      .filter(f => f.startsWith('lesson-') && f.endsWith('.json'));
    
    files.forEach(file => {
      const lessonPath = join(config.paths.processed, file);
      const lesson = JSON.parse(readFileSync(lessonPath, 'utf-8'));
      
      if (lesson.enriched) {
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
