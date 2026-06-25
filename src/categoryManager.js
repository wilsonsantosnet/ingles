import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { config } from './config.js';

/**
 * Gerenciamento de categorias de estudo
 */
export class CategoryManager {
  constructor() {
    this.categoriesPath = config.paths.categoriesJson;
    this.ensureCategoriesFile();
  }

  /**
   * Garante que o arquivo de categorias existe
   */
  ensureCategoriesFile() {
    if (!existsSync(this.categoriesPath)) {
      const defaultCategories = {
        categories: [
          {
            id: 'ingles',
            name: 'Inglês',
            description: 'Estudo de inglês técnico e conversação',
            icon: '🇺🇸',
            color: '#4A90E2',
            createdAt: new Date().toISOString()
          }
        ]
      };
      writeFileSync(this.categoriesPath, JSON.stringify(defaultCategories, null, 2), 'utf-8');
    }
  }

  /**
   * Lista todas as categorias
   * @returns {Array} Lista de categorias
   */
  listCategories() {
    try {
      const data = readFileSync(this.categoriesPath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.categories || [];
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      return [];
    }
  }

  /**
   * Obtém uma categoria específica
   * @param {string} categoryId - ID da categoria
   * @returns {Object|null} Categoria encontrada ou null
   */
  getCategory(categoryId) {
    const categories = this.listCategories();
    return categories.find(c => c.id === categoryId) || null;
  }

  /**
   * Cria uma nova categoria
   * @param {Object} categoryData - Dados da categoria
   * @returns {Object} Categoria criada
   */
  createCategory(categoryData) {
    const categories = this.listCategories();
    
    // Validar ID único
    if (categories.find(c => c.id === categoryData.id)) {
      throw new Error(`Categoria com ID '${categoryData.id}' já existe`);
    }

    // Validar campos obrigatórios
    if (!categoryData.id || !categoryData.name) {
      throw new Error('Campos obrigatórios: id, name');
    }

    const newCategory = {
      id: categoryData.id,
      name: categoryData.name,
      description: categoryData.description || '',
      icon: categoryData.icon || '📚',
      color: categoryData.color || '#4A90E2',
      createdAt: new Date().toISOString()
    };

    // Adicionar categoria
    categories.push(newCategory);
    
    // Salvar arquivo
    writeFileSync(
      this.categoriesPath,
      JSON.stringify({ categories }, null, 2),
      'utf-8'
    );

    // Criar pastas necessárias
    const paths = config.getCategoryPaths(newCategory.id);
    if (!existsSync(paths.processed)) {
      mkdirSync(paths.processed, { recursive: true });
    }
    if (!existsSync(paths.docs)) {
      mkdirSync(paths.docs, { recursive: true });
    }

    // Criar index vazio
    writeFileSync(
      paths.index,
      JSON.stringify({ lessons: [] }, null, 2),
      'utf-8'
    );

    console.log(`✅ Categoria '${newCategory.name}' criada com sucesso!`);
    return newCategory;
  }

  /**
   * Atualiza uma categoria existente
   * @param {string} categoryId - ID da categoria
   * @param {Object} updates - Dados para atualizar
   * @returns {Object} Categoria atualizada
   */
  updateCategory(categoryId, updates) {
    const categories = this.listCategories();
    const index = categories.findIndex(c => c.id === categoryId);
    
    if (index === -1) {
      throw new Error(`Categoria '${categoryId}' não encontrada`);
    }

    // Não permitir alterar o ID
    delete updates.id;
    delete updates.createdAt;

    // Atualizar categoria
    categories[index] = {
      ...categories[index],
      ...updates
    };

    // Salvar
    writeFileSync(
      this.categoriesPath,
      JSON.stringify({ categories }, null, 2),
      'utf-8'
    );

    return categories[index];
  }

  /**
   * Remove uma categoria
   * @param {string} categoryId - ID da categoria
   */
  deleteCategory(categoryId) {
    const categories = this.listCategories();
    const filtered = categories.filter(c => c.id !== categoryId);
    
    if (filtered.length === categories.length) {
      throw new Error(`Categoria '${categoryId}' não encontrada`);
    }

    // Salvar
    writeFileSync(
      this.categoriesPath,
      JSON.stringify({ categories: filtered }, null, 2),
      'utf-8'
    );

    console.log(`⚠️  Categoria '${categoryId}' removida. Os dados em data/categories/${categoryId}/ foram preservados.`);
  }
}
