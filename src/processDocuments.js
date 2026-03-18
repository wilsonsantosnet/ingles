import { readdir, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';
import { extractWordContent, parseLesson } from './wordExtractor.js';
import { enrichWithLLM } from './llmEnricher.js';
import { SpacedRepetitionSystem } from './spacedRepetition.js';

/**
 * Processa documentos Word na pasta docs
 * @param {boolean} force - Se true, reprocessa todos os arquivos
 */
async function processAllDocuments(force = false) {
  console.log('📚 Iniciando processamento de documentos...\n');
  
  if (force) {
    console.log('⚠️  Modo FORCE ativado: reprocessando TODOS os arquivos\n');
  } else {
    console.log('✅ Modo incremental: processando apenas arquivos novos\n');
  }

  // Criar pasta de dados se não existir
  if (!existsSync(config.paths.processed)) {
    mkdirSync(config.paths.processed, { recursive: true });
  }

  // Listar arquivos .docx
  const files = await new Promise((resolve, reject) => {
    readdir(config.paths.docs, (err, files) => {
      if (err) reject(err);
      else resolve(files.filter(f => f.endsWith('.docx')));
    });
  });

  console.log(`📄 Encontrados ${files.length} documentos\n`);

  const srs = new SpacedRepetitionSystem();
  const processedLessons = [];
  let skipped = 0;

  for (const file of files) {
    const filePath = join(config.paths.docs, file);
    
    // 1. Extrair conteúdo do Word
    const extracted = await extractWordContent(filePath);
    if (!extracted.success || !extracted.text || extracted.text.trim().length === 0) {
      console.log(`\n⚠️  Pulando ${file}: não foi possível ler ou documento vazio`);
      continue;
    }
    
    // 2. Parsear para obter ID e verificar se já foi processado
    const lesson = parseLesson(extracted.text, file);
    const outputPath = join(config.paths.processed, `${lesson.id}.json`);
    
    // Verificar se já foi processado (somente se não for modo force)
    if (!force && existsSync(outputPath)) {
      console.log(`⏭️  Pulando ${file} (já processado)`);
      skipped++;
      
      // Ainda assim adicionar ao índice
      processedLessons.push({
        id: lesson.id,
        date: lesson.date,
        title: lesson.title,
        file: file,
        status: 'enriched'
      });
      continue;
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📖 Processando: ${file}`);
    console.log('='.repeat(60));
    console.log('1️⃣  Extraindo conteúdo...');
    console.log(`   ✅ Extraído com sucesso: ${extracted.text.length} caracteres`);

    // 3. Analisar estrutura
    console.log('2️⃣  Analisando estrutura...');

    // 4. Enriquecer com LLM
    const enrichedLesson = await enrichWithLLM(lesson);

    // 5. Adicionar dados de repetição espaçada
    console.log('3️⃣  Configurando repetição espaçada...');
    const lessonWithSRS = addSpacedRepetitionData(enrichedLesson, srs);

    // 6. Salvar JSON
    writeFileSync(outputPath, JSON.stringify(lessonWithSRS, null, 2), 'utf-8');
    
    console.log(`✅ Salvo em: ${outputPath}`);
    
    processedLessons.push({
      id: lesson.id,
      date: lesson.date,
      title: lesson.title,
      file: file,
      status: enrichedLesson.status
    });
  }

  // Salvar índice de todas as aulas
  const indexPath = join(config.paths.processed, 'index.json');
  writeFileSync(indexPath, JSON.stringify({
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
const force = process.argv.includes('--force');
processAllDocuments(force).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
