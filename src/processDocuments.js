import { readdir, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { config } from './config.js';
import { extractWordContent, parseLesson } from './wordExtractor.js';
import { enrichWithLLM } from './llmEnricher.js';
import { SpacedRepetitionSystem } from './spacedRepetition.js';
import { CategoryManager } from './categoryManager.js';
import { LessonManager } from './lessonManager.js';
import { imageProcessor } from './imageProcessor.js';

/**
 * Processa documentos Word na pasta docs de uma categoria
 * @param {string} categoryId - ID da categoria (padrão: 'ingles')
 * @param {boolean} force - Se true, reprocessa todos os arquivos
 */
async function processAllDocuments(categoryId = 'ingles', force = false) {
  console.log('📚 Iniciando processamento de documentos...\n');
  
  // Validar categoria
  const categoryManager = new CategoryManager();
  const category = categoryManager.getCategory(categoryId);
  if (!category) {
    console.error(`❌ Categoria '${categoryId}' não encontrada!`);
    console.log('\n📋 Categorias disponíveis:');
    categoryManager.listCategories().forEach(c => {
      console.log(`   - ${c.id}: ${c.name}`);
    });
    process.exit(1);
  }
  
  console.log(`📂 Categoria: ${category.icon} ${category.name}`);
  
  if (force) {
    console.log('⚠️  Modo FORCE ativado: reprocessando TODOS os arquivos\n');
  } else {
    console.log('✅ Modo incremental: processando apenas arquivos novos\n');
  }

  const paths = config.getCategoryPaths(categoryId);

  // Criar pasta de dados se não existir
  if (!existsSync(paths.processed)) {
    mkdirSync(paths.processed, { recursive: true });
  }
  
  // Criar pasta de docs se não existir
  if (!existsSync(paths.docs)) {
    mkdirSync(paths.docs, { recursive: true });
    console.log(`\n⚠️  Pasta de documentos criada: ${paths.docs}`);
    console.log(`   Adicione arquivos .docx nesta pasta e execute novamente.\n`);
    process.exit(0);
  }

  // Listar arquivos .docx e imagens (.jpg, .jpeg, .png)
  const files = await new Promise((resolve, reject) => {
    readdir(paths.docs, (err, files) => {
      if (err) reject(err);
      else resolve(files.filter(f => {
        const ext = extname(f).toLowerCase();
        return ['.docx', '.jpg', '.jpeg', '.png'].includes(ext);
      }));
    });
  });

  if (files.length === 0) {
    console.log(`\n⚠️  Nenhum arquivo encontrado em: ${paths.docs}`);
    console.log(`   Adicione documentos Word (.docx) ou imagens (.jpg, .png) e execute novamente.\n`);
    process.exit(0);
  }

  console.log(`📄 Encontrados ${files.length} arquivos\n`);

  const srs = new SpacedRepetitionSystem();
  const lessonManager = new LessonManager();
  const processedLessons = [];
  let skipped = 0;

  for (const file of files) {
    const filePath = join(paths.docs, file);
    const fileExt = extname(file).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png'].includes(fileExt);
    
    // 1. Extrair conteúdo (Word ou Imagem)
    let extracted;
    let source;
    
    if (isImage) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📸 Processando IMAGEM: ${file}`);
      console.log('='.repeat(60));
      
      try {
        const ocrResult = await imageProcessor.extractTextFromImage(filePath);
        
        if (!ocrResult.success || !ocrResult.text || ocrResult.text.trim().length === 0) {
          console.log(`\n⚠️  Pulando ${file}: OCR falhou ou imagem sem texto`);
          continue;
        }
        
        console.log(`   ✅ Texto extraído: ${ocrResult.text.length} caracteres`);
        console.log(`   📊 Qualidade: ${ocrResult.quality} (confiança: ${(ocrResult.confidence * 100).toFixed(1)}%)`);
        
        if (ocrResult.quality === 'poor') {
          console.log(`   ⚠️  AVISO: Qualidade baixa - revise o conteúdo extraído`);
        }
        
        extracted = {
          success: true,
          text: ocrResult.text,
          metadata: ocrResult.metadata
        };
        source = 'image';
        
      } catch (error) {
        console.log(`\n❌ Erro ao processar imagem ${file}: ${error.message}`);
        continue;
      }
      
    } else {
      // Processar Word
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📖 Processando DOCUMENTO: ${file}`);
      console.log('='.repeat(60));
      console.log('1️⃣  Extraindo conteúdo...');
      
      extracted = await extractWordContent(filePath);
      source = 'docx';
      
      if (!extracted.success || !extracted.text || extracted.text.trim().length === 0) {
        console.log(`\n⚠️  Pulando ${file}: não foi possível ler ou documento vazio`);
        continue;
      }
      
      console.log(`   ✅ Extraído com sucesso: ${extracted.text.length} caracteres`);
    }
    
    // 2. Parsear para obter ID e verificar se já foi processado
    const lesson = parseLesson(extracted.text, file);
    lesson.source = source; // Adicionar fonte
    
    // Gerar ID único com indexador para múltiplas aulas no mesmo dia
    lesson.id = lessonManager.generateNextLessonId(categoryId, lesson.date);
    const outputPath = join(paths.processed, `${lesson.id}.json`);
    
    // Verificar se já foi processado (somente se não for modo force)
    if (!force && existsSync(outputPath)) {
      console.log(`⏭️  Pulando ${file} (já processado)`);
      skipped++;

      let existingTitle = lesson.title;
      try {
        const existingLesson = JSON.parse(readFileSync(outputPath, 'utf-8'));
        if (existingLesson?.title) {
          existingTitle = existingLesson.title;
        }
      } catch {
        // Mantém fallback do título atual se não conseguir ler o arquivo existente.
      }
      
      // Ainda assim adicionar ao índice
      processedLessons.push({
        id: lesson.id,
        date: lesson.date,
        title: existingTitle,
        file: source,
        status: 'enriched'
      });
      continue;
    }

    // 3. Analisar estrutura
    console.log('2️⃣  Analisando estrutura...');

    // 4. Enriquecer com LLM
    const enrichedLesson = await enrichWithLLM(lesson, category);

    // 5. Adicionar dados de repetição espaçada
    console.log('3️⃣  Configurando repetição espaçada...');
    const lessonWithSRS = addSpacedRepetitionData(enrichedLesson, srs);

    // 6. Salvar JSON
    writeFileSync(outputPath, JSON.stringify(lessonWithSRS, null, 2), 'utf-8');
    
    console.log(`✅ Salvo em: ${outputPath}`);
    
    processedLessons.push({
      id: lessonWithSRS.id,
      date: lessonWithSRS.date,
      title: lessonWithSRS.title,
      file: source,
      status: enrichedLesson.status
    });
  }

  // Salvar índice de todas as aulas
  const indexPath = paths.index;
  writeFileSync(indexPath, JSON.stringify({
    categoryId: categoryId,
    processedAt: new Date().toISOString(),
    totalLessons: processedLessons.length,
    lessons: processedLessons
  }, null, 2), 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log('✨ Processamento concluído!');
  console.log(`📊 Total de aulas no índice: ${processedLessons.length}`);
  if (skipped > 0) {
    console.log(`⏭️  Arquivos já processados (pulados): ${skipped}`);
  }
  console.log(`🆕 Arquivos processados agora: ${processedLessons.length - skipped}`);
  console.log(`📁 Índice salvo em: ${indexPath}`);
  console.log('='.repeat(60));
}

/**
 * Adiciona dados de repetição espaçada aos itens da aula
 * @param {Object} lesson - Aula enriquecida
 * @param {SpacedRepetitionSystem} srs - Sistema SRS
 * @returns {Object} Aula com dados SRS
 */
function addSpacedRepetitionData(lesson, srs) {
  if (!lesson.enriched) {
    return lesson;
  }

  const withSRS = { ...lesson };

  // Adicionar SRS a vocabulário
  if (withSRS.enriched.vocabulary) {
    withSRS.enriched.vocabulary = withSRS.enriched.vocabulary.map(item => ({
      ...item,
      id: `vocab-${lesson.id}-${item.word.toLowerCase().replace(/\s+/g, '-')}`,
      spacedRepetition: srs.initializeItem()
    }));
  }

  // Adicionar SRS a questões práticas
  if (withSRS.enriched.practiceQuestions) {
    withSRS.enriched.practiceQuestions = withSRS.enriched.practiceQuestions.map((item, idx) => ({
      ...item,
      id: `question-${lesson.id}-${idx}`,
      spacedRepetition: srs.initializeItem()
    }));
  }

  // Adicionar SRS a gramática
  if (withSRS.enriched.grammar) {
    withSRS.enriched.grammar = withSRS.enriched.grammar.map((item, idx) => ({
      ...item,
      id: `grammar-${lesson.id}-${idx}`,
      spacedRepetition: srs.initializeItem()
    }));
  }

  return withSRS;
}

// Executar processamento
const args = process.argv.slice(2);
const categoryArg = args.find(arg => arg.startsWith('--category='));
const categoryId = categoryArg ? categoryArg.split('=')[1] : 'ingles';
const force = args.includes('--force');

console.log('\n🎯 Parâmetros:');
console.log(`   Categoria: ${categoryId}`);
console.log(`   Modo force: ${force ? 'Sim' : 'Não'}\n`);

processAllDocuments(categoryId, force).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
