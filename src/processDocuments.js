import { readdir, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { createHash } from 'crypto';
import { config } from './config.js';
import { extractWordContent, parseLesson } from './wordExtractor.js';
import { enrichWithLLM } from './llmEnricher.js';
import { SpacedRepetitionSystem } from './spacedRepetition.js';
import { CategoryManager } from './categoryManager.js';
import { LessonManager } from './lessonManager.js';
import { imageProcessor } from './imageProcessor.js';

/**
 * Carrega o índice existente da categoria.
 * @param {string} indexPath - Caminho do arquivo index.json
 * @returns {{lessons: Array}} Estrutura do índice
 */
function loadExistingIndex(indexPath) {
  if (!existsSync(indexPath)) {
    return { lessons: [] };
  }

  try {
    const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
    return {
      ...indexData,
      lessons: Array.isArray(indexData.lessons) ? indexData.lessons : []
    };
  } catch {
    return { lessons: [] };
  }
}

/**
 * Constrói lookup de aulas já processadas por nome de arquivo de origem.
 * @param {Array} lessons - Itens do índice atual
 * @param {string} processedPath - Pasta das aulas processadas
 * @returns {Map<string, Object>} Mapa por sourceFile normalizado (lowercase)
 */
function buildSourceFileLookup(lessons, processedPath) {
  const sourceLookup = new Map();

  for (const item of lessons) {
    if (!item?.sourceFile) {
      continue;
    }

    sourceLookup.set(item.sourceFile.toLowerCase(), {
      id: item.id,
      date: item.date,
      title: item.title,
      file: item.file,
      status: item.status,
      sourceFile: item.sourceFile
    });
  }

  // Compatibilidade com dados antigos: tenta hidratar sourceFile lendo as aulas já salvas.
  for (const item of lessons) {
    if (!item?.id || item.sourceFile) {
      continue;
    }

    const lessonPath = join(processedPath, `${item.id}.json`);
    if (!existsSync(lessonPath)) {
      continue;
    }

    try {
      const lessonData = JSON.parse(readFileSync(lessonPath, 'utf-8'));
      if (!lessonData?.sourceFile) {
        continue;
      }

      sourceLookup.set(lessonData.sourceFile.toLowerCase(), {
        id: item.id,
        date: item.date,
        title: item.title,
        file: item.file,
        status: item.status,
        sourceFile: lessonData.sourceFile
      });
    } catch {
      // Ignora item inválido e segue processamento.
    }
  }

  return sourceLookup;
}

/**
 * Gera hash estável de texto para comparação de conteúdo.
 * @param {string} text - Texto para gerar hash
 * @returns {string} Hash SHA-1 em hexadecimal
 */
function hashText(text) {
  return createHash('sha1').update(text || '', 'utf-8').digest('hex');
}

/**
 * Constrói lookup por hash do rawContent para compatibilidade com dados legados.
 * @param {Array} lessons - Itens do índice atual
 * @param {string} processedPath - Pasta das aulas processadas
 * @returns {Map<string, Object>} Mapa por hash de conteúdo
 */
function buildContentHashLookup(lessons, processedPath) {
  const contentLookup = new Map();

  for (const item of lessons) {
    if (!item?.id) {
      continue;
    }

    const lessonPath = join(processedPath, `${item.id}.json`);
    if (!existsSync(lessonPath)) {
      continue;
    }

    try {
      const lessonData = JSON.parse(readFileSync(lessonPath, 'utf-8'));
      if (!lessonData?.rawContent) {
        continue;
      }

      const contentHash = hashText(lessonData.rawContent);
      if (!contentLookup.has(contentHash)) {
        contentLookup.set(contentHash, {
          id: item.id,
          date: item.date,
          title: item.title,
          file: item.file,
          status: item.status,
          sourceFile: item.sourceFile || lessonData.sourceFile,
          isLegacy: !item.sourceFile && !lessonData.sourceFile
        });
      }
    } catch {
      // Ignora item inválido e segue processamento.
    }
  }

  return contentLookup;
}

/**
 * Atualiza uma aula legada com sourceFile para acelerar próximos processamentos incrementais.
 * @param {string} processedPath - Pasta das aulas processadas
 * @param {string} lessonId - ID da aula
 * @param {string} sourceFile - Nome do arquivo de origem
 */
function attachSourceFileToLesson(processedPath, lessonId, sourceFile) {
  const lessonPath = join(processedPath, `${lessonId}.json`);
  if (!existsSync(lessonPath)) {
    return;
  }

  try {
    const lessonData = JSON.parse(readFileSync(lessonPath, 'utf-8'));
    if (lessonData.sourceFile === sourceFile) {
      return;
    }

    lessonData.sourceFile = sourceFile;
    writeFileSync(lessonPath, JSON.stringify(lessonData, null, 2), 'utf-8');
  } catch {
    // Se falhar atualização, mantém comportamento principal sem interromper o processamento.
  }
}

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
  const existingIndex = loadExistingIndex(paths.index);
  const processedBySourceFile = buildSourceFileLookup(existingIndex.lessons, paths.processed);
  const processedByContentHash = buildContentHashLookup(existingIndex.lessons, paths.processed);
  const processedLessons = [];
  let skipped = 0;

  for (const file of files) {
    const filePath = join(paths.docs, file);
    const fileExt = extname(file).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png'].includes(fileExt);
    const normalizedSourceFile = file.toLowerCase();

    // Modo incremental real: usa nome do arquivo de origem como referência.
    if (!force && processedBySourceFile.has(normalizedSourceFile)) {
      const existingLesson = processedBySourceFile.get(normalizedSourceFile);
      console.log(`⏭️  Pulando ${file} (já processado como ${existingLesson.id})`);
      skipped++;

      processedLessons.push({
        id: existingLesson.id,
        date: existingLesson.date,
        title: existingLesson.title,
        file: existingLesson.file || (isImage ? 'image' : 'docx'),
        status: existingLesson.status || 'enriched',
        sourceFile: existingLesson.sourceFile || file
      });
      continue;
    }
    
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
    lesson.sourceFile = file; // Vincular ao arquivo original para processamento incremental

    // Fallback para dados legados: identifica arquivo já processado pelo conteúdo.
    const rawContentHash = hashText(extracted.text);
    if (!force && processedByContentHash.has(rawContentHash)) {
      const existingLesson = processedByContentHash.get(rawContentHash);
      if (!existingLesson.isLegacy) {
        // Conteúdo repetido com sourceFile já conhecido: mantém processamento normal.
        // Isso permite aulas diferentes com texto igual, desde que sejam arquivos distintos.
      } else {
      console.log(`⏭️  Pulando ${file} (conteúdo já processado como ${existingLesson.id})`);
      skipped++;

      // Migração transparente: salva sourceFile na aula legada para próximos ciclos incrementais.
      attachSourceFileToLesson(paths.processed, existingLesson.id, file);

      processedBySourceFile.set(normalizedSourceFile, {
        ...existingLesson,
        sourceFile: file
      });

      processedLessons.push({
        id: existingLesson.id,
        date: existingLesson.date,
        title: existingLesson.title,
        file: existingLesson.file || source,
        status: existingLesson.status || 'enriched',
        sourceFile: file
      });
      continue;
      }
    }
    
    // Gerar ID único com indexador para múltiplas aulas no mesmo dia
    lesson.id = lessonManager.generateNextLessonId(categoryId, lesson.date);
    const outputPath = join(paths.processed, `${lesson.id}.json`);

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
      status: enrichedLesson.status,
      sourceFile: file
    });

    processedBySourceFile.set(normalizedSourceFile, {
      id: lessonWithSRS.id,
      date: lessonWithSRS.date,
      title: lessonWithSRS.title,
      file: source,
      status: enrichedLesson.status,
      sourceFile: file
    });
    processedByContentHash.set(rawContentHash, {
      id: lessonWithSRS.id,
      date: lessonWithSRS.date,
      title: lessonWithSRS.title,
      file: source,
      status: enrichedLesson.status,
      sourceFile: file,
      isLegacy: false
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
