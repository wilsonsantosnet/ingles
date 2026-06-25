import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

/**
 * Script para limpar títulos das aulas existentes
 * Substitui títulos muito longos por títulos mais curtos e legíveis
 */

const categoryId = process.argv[2] || 'ingles';

console.log(`🧹 Limpando títulos das aulas da categoria: ${categoryId}\n`);

const paths = config.getCategoryPaths(categoryId);
const processedDir = paths.processed;

// Listar todos os arquivos JSON
const files = readdirSync(processedDir).filter(f => f.startsWith('lesson-') && f.endsWith('.json'));

console.log(`📚 Encontradas ${files.length} aulas\n`);

let updated = 0;

files.forEach(file => {
  const filePath = join(processedDir, file);
  const lesson = JSON.parse(readFileSync(filePath, 'utf-8'));
  
  // Verificar se o título está muito longo (mais de 100 caracteres)
  if (lesson.title && lesson.title.length > 100) {
    const oldTitle = lesson.title;
    
    // Opções para novo título (em ordem de prioridade):
    // 1. Usar mainTopics se existir
    // 2. Usar primeiros 80 caracteres
    // 3. Usar a data
    
    let newTitle;
    
    if (lesson.enriched?.mainTopics && lesson.enriched.mainTopics.length > 0) {
      // Usar tópicos principais
      newTitle = lesson.enriched.mainTopics.slice(0, 3).join(', ');
    } else if (lesson.enriched?.summary && lesson.enriched.summary.length > 0) {
      // Criar título do resumo (primeira frase)
      const firstSentence = lesson.enriched.summary.split('.')[0];
      newTitle = firstSentence.length > 80 
        ? firstSentence.substring(0, 77) + '...' 
        : firstSentence;
    } else {
      // Usar primeira linha do conteúdo (limitada)
      const firstLine = lesson.rawContent.split('\n')[0] || lesson.title;
      newTitle = firstLine.length > 80 
        ? firstLine.substring(0, 77) + '...' 
        : firstLine;
    }
    
    // Se ainda está muito longo, usar data
    if (newTitle.length > 100) {
      const date = new Date(lesson.date);
      newTitle = `Aula de ${date.toLocaleDateString('pt-BR')}`;
    }
    
    lesson.title = newTitle;
    
    // Salvar arquivo atualizado
    writeFileSync(filePath, JSON.stringify(lesson, null, 2), 'utf-8');
    
    console.log(`✅ ${lesson.id}`);
    console.log(`   Antes: ${oldTitle.substring(0, 80)}...`);
    console.log(`   Depois: ${newTitle}\n`);
    
    updated++;
  } else {
    console.log(`⏭️  ${lesson.id} - Título OK (${lesson.title.length} chars)`);
  }
});

// Atualizar índice
const indexPath = paths.index;
if (readdirSync(processedDir).includes('index.json')) {
  const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  
  // Atualizar títulos no índice
  index.lessons = index.lessons.map(l => {
    const lessonPath = join(processedDir, `${l.id}.json`);
    const lesson = JSON.parse(readFileSync(lessonPath, 'utf-8'));
    return {
      ...l,
      title: lesson.title
    };
  });
  
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`\n📝 Índice atualizado: ${indexPath}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`✨ Limpeza concluída!`);
console.log(`📊 Total de aulas verificadas: ${files.length}`);
console.log(`🔄 Títulos atualizados: ${updated}`);
console.log(`⏭️  Títulos mantidos: ${files.length - updated}`);
console.log('='.repeat(60));
