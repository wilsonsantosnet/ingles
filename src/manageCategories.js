#!/usr/bin/env node
import { CategoryManager } from './categoryManager.js';

const categoryManager = new CategoryManager();

/**
 * CLI para gerenciar categorias de estudo
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('\n📚 Gerenciador de Categorias\n');

  switch (command) {
    case 'list':
      listCategories();
      break;
    
    case 'create':
      createCategory(args);
      break;
    
    case 'info':
      showCategoryInfo(args[1]);
      break;
    
    case 'delete':
      deleteCategory(args[1]);
      break;
    
    default:
      showHelp();
  }
}

/**
 * Lista todas as categorias
 */
function listCategories() {
  const categories = categoryManager.listCategories();
  
  if (categories.length === 0) {
    console.log('⚠️  Nenhuma categoria encontrada.\n');
    return;
  }

  console.log('📋 Categorias disponíveis:\n');
  categories.forEach(cat => {
    console.log(`   ${cat.icon} ${cat.name} (${cat.id})`);
    console.log(`      ${cat.description}`);
    console.log(`      Criada em: ${new Date(cat.createdAt).toLocaleDateString('pt-BR')}`);
    console.log('');
  });
}

/**
 * Cria nova categoria
 */
function createCategory(args) {
  const idIndex = args.indexOf('--id');
  const nameIndex = args.indexOf('--name');
  const descIndex = args.indexOf('--description');
  const iconIndex = args.indexOf('--icon');

  if (idIndex === -1 || nameIndex === -1) {
    console.error('❌ Parâmetros obrigatórios: --id e --name\n');
    console.log('Exemplo:');
    console.log('  node src/manageCategories.js create --id az104 --name "Azure AZ-104" --description "Microsoft Azure Administrator" --icon ☁️\n');
    return;
  }

  const categoryData = {
    id: args[idIndex + 1],
    name: args[nameIndex + 1],
    description: descIndex !== -1 ? args[descIndex + 1] : '',
    icon: iconIndex !== -1 ? args[iconIndex + 1] : '📚'
  };

  try {
    const category = categoryManager.createCategory(categoryData);
    console.log(`✅ Categoria criada com sucesso!\n`);
    console.log(`   ${category.icon} ${category.name} (${category.id})`);
    console.log(`   ${category.description}\n`);
    console.log(`📁 Pastas criadas:`);
    console.log(`   - docs/${category.id}/ (adicione documentos Word aqui)`);
    console.log(`   - data/categories/${category.id}/ (dados processados)\n`);
    console.log(`🚀 Próximos passos:`);
    console.log(`   1. Adicione documentos .docx em docs/${category.id}/`);
    console.log(`   2. Execute: npm run process -- --category=${category.id}\n`);
  } catch (error) {
    console.error(`❌ Erro: ${error.message}\n`);
  }
}

/**
 * Mostra informações de uma categoria
 */
function showCategoryInfo(categoryId) {
  if (!categoryId) {
    console.error('❌ Especifique o ID da categoria\n');
    console.log('Exemplo: node src/manageCategories.js info ingles\n');
    return;
  }

  const category = categoryManager.getCategory(categoryId);
  
  if (!category) {
    console.error(`❌ Categoria '${categoryId}' não encontrada\n`);
    listCategories();
    return;
  }

  console.log(`${category.icon} ${category.name}\n`);
  console.log(`ID: ${category.id}`);
  console.log(`Descrição: ${category.description}`);
  console.log(`Cor: ${category.color}`);
  console.log(`Criada em: ${new Date(category.createdAt).toLocaleDateString('pt-BR')}`);
  console.log('');
}

/**
 * Remove uma categoria
 */
function deleteCategory(categoryId) {
  if (!categoryId) {
    console.error('❌ Especifique o ID da categoria\n');
    console.log('Exemplo: node src/manageCategories.js delete az104\n');
    return;
  }

  try {
    categoryManager.deleteCategory(categoryId);
    console.log(`✅ Categoria '${categoryId}' removida\n`);
    console.log(`⚠️  Os arquivos em data/categories/${categoryId}/ foram preservados.\n`);
  } catch (error) {
    console.error(`❌ Erro: ${error.message}\n`);
  }
}

/**
 * Mostra ajuda
 */
function showHelp() {
  console.log('Uso: node src/manageCategories.js <comando> [opções]\n');
  console.log('Comandos:\n');
  console.log('  list                                  Lista todas as categorias');
  console.log('  create --id ID --name "Nome" [opts]   Cria nova categoria');
  console.log('  info <id>                             Mostra informações da categoria');
  console.log('  delete <id>                           Remove categoria\n');
  console.log('Opções para create:\n');
  console.log('  --id <id>                ID único da categoria (obrigatório)');
  console.log('  --name "Nome"            Nome da categoria (obrigatório)');
  console.log('  --description "Desc"     Descrição da categoria');
  console.log('  --icon "emoji"           Ícone da categoria (emoji)\n');
  console.log('Exemplos:\n');
  console.log('  node src/manageCategories.js list');
  console.log('  node src/manageCategories.js create --id az104 --name "Azure AZ-104" --icon ☁️');
  console.log('  node src/manageCategories.js info ingles');
  console.log('');
}

// Executar CLI
main();
