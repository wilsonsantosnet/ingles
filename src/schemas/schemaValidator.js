/**
 * Schema Validator - Validador de estruturas JSON por tipo de categoria
 * 
 * Este módulo fornece funções de validação para garantir que o conteúdo
 * enriquecido gerado pelo LLM corresponde à estrutura esperada para cada
 * tipo de categoria (language, technology).
 */

/**
 * Estrutura padrão de resultado de validação
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Indica se a validação passou
 * @property {string[]} errors - Erros críticos (campos obrigatórios faltando, tipos incorretos)
 * @property {string[]} warnings - Avisos (campos inesperados, contagens baixas)
 * @property {string[]} missingFields - Campos obrigatórios ausentes
 * @property {string[]} unexpectedFields - Campos não esperados para este tipo
 */

/**
 * Valida se um objeto tem todos os campos requeridos
 * @param {Object} obj - Objeto a validar
 * @param {string[]} requiredFields - Lista de campos obrigatórios
 * @returns {string[]} Lista de campos faltando
 */
function checkRequiredFields(obj, requiredFields) {
  const missingFields = [];
  for (const field of requiredFields) {
    if (!(field in obj)) {
      missingFields.push(field);
    }
  }
  return missingFields;
}

/**
 * Valida se um objeto não contém campos proibidos
 * @param {Object} obj - Objeto a validar
 * @param {string[]} forbiddenFields - Lista de campos não permitidos
 * @returns {string[]} Lista de campos inesperados presentes
 */
function checkForbiddenFields(obj, forbiddenFields) {
  const unexpectedFields = [];
  for (const field of forbiddenFields) {
    if (field in obj) {
      unexpectedFields.push(field);
    }
  }
  return unexpectedFields;
}

/**
 * Valida se um array tem quantidade mínima de elementos
 * @param {Array} arr - Array a validar
 * @param {number} minItems - Quantidade mínima esperada
 * @param {string} fieldName - Nome do campo (para mensagens de erro)
 * @returns {string|null} Mensagem de warning se abaixo do mínimo, null caso contrário
 */
function checkMinimumCount(arr, minItems, fieldName) {
  if (!Array.isArray(arr)) {
    return `${fieldName} deve ser um array`;
  }
  if (arr.length < minItems) {
    return `${fieldName} tem apenas ${arr.length} item(ns), recomendado mínimo de ${minItems}`;
  }
  return null;
}

/**
 * Gera resultado de validação consolidado
 * @param {string[]} missingFields - Campos obrigatórios faltando
 * @param {string[]} unexpectedFields - Campos inesperados presentes
 * @param {string[]} warnings - Avisos de qualidade
 * @returns {ValidationResult}
 */
function buildValidationResult(missingFields, unexpectedFields, warnings) {
  const errors = [];
  
  // Erros por campos faltando
  if (missingFields.length > 0) {
    errors.push(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
  }
  
  // Avisos (não erros) por campos inesperados
  if (unexpectedFields.length > 0) {
    warnings.push(`Campos inesperados para este tipo: ${unexpectedFields.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingFields,
    unexpectedFields
  };
}

/**
 * Valida estrutura completa incluindo campo "enriched"
 * @param {Object} content - Objeto contendo o campo "enriched"
 * @param {Function} typeValidator - Função de validação específica do tipo
 * @returns {ValidationResult}
 */
export function validateContent(content, typeValidator) {
  // Validar que o objeto tem campo "enriched"
  if (!content || typeof content !== 'object') {
    return {
      isValid: false,
      errors: ['Conteúdo deve ser um objeto'],
      warnings: [],
      missingFields: ['enriched'],
      unexpectedFields: []
    };
  }
  
  if (!('enriched' in content)) {
    return {
      isValid: false,
      errors: ['Campo "enriched" é obrigatório'],
      warnings: [],
      missingFields: ['enriched'],
      unexpectedFields: []
    };
  }
  
  // Delegar validação do conteúdo enriquecido para o validador específico do tipo
  return typeValidator(content.enriched);
}

export {
  checkRequiredFields,
  checkForbiddenFields,
  checkMinimumCount,
  buildValidationResult
};
