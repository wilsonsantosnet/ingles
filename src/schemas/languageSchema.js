/**
 * Language Schema Validator - Validador para categorias de idiomas
 * 
 * Valida estruturas de conteúdo enriquecido para categorias do tipo "language".
 * Estrutura esperada: vocabulary, grammar, expressions, exercises, culturalNotes
 */

import {
  checkRequiredFields,
  checkForbiddenFields,
  checkMinimumCount,
  buildValidationResult
} from './schemaValidator.js';

/**
 * Campos obrigatórios para categorias de idioma
 */
const REQUIRED_FIELDS = [
  'vocabulary',
  'grammar',
  'expressions',
  'practiceQuestions',  // Corrigido: idiomas usam practiceQuestions, não exercises
  'culturalNotes'
];

/**
 * Campos proibidos para categorias de idioma (pertencem a outros tipos)
 */
const FORBIDDEN_FIELDS = [
  'topics',       // campo de technology
  'concepts',     // campo de technology
  'commands',     // campo de technology
  'scenarios',    // campo de technology
  'examTips'      // campo de technology
];

/**
 * Recomendações de quantidade mínima de itens
 */
const MINIMUM_RECOMMENDATIONS = {
  vocabulary: 1,            // Pelo menos 1 palavra
  grammar: 1,               // Pelo menos 1 tópico gramatical
  practiceQuestions: 3      // Pelo menos 3 perguntas práticas recomendadas
};

/**
 * Valida estrutura de conteúdo enriquecido para idiomas
 * @param {Object} enrichedContent - Objeto enriched do JSON da lição
 * @returns {ValidationResult}
 */
export function validateLanguageStructure(enrichedContent) {
  const warnings = [];
  
  // Verificar campos obrigatórios
  const missingFields = checkRequiredFields(enrichedContent, REQUIRED_FIELDS);
  
  // Verificar campos proibidos (não devem estar presentes)
  const unexpectedFields = checkForbiddenFields(enrichedContent, FORBIDDEN_FIELDS);
  
  // Verificar contagens mínimas recomendadas (se campo existir)
  if (enrichedContent.vocabulary) {
    const warning = checkMinimumCount(
      enrichedContent.vocabulary,
      MINIMUM_RECOMMENDATIONS.vocabulary,
      'vocabulary'
    );
    if (warning) warnings.push(warning);
  }
  
  if (enrichedContent.grammar) {
    const warning = checkMinimumCount(
      enrichedContent.grammar,
      MINIMUM_RECOMMENDATIONS.grammar,
      'grammar'
    );
    if (warning) warnings.push(warning);
  }
  
  if (enrichedContent.practiceQuestions) {
    const warning = checkMinimumCount(
      enrichedContent.practiceQuestions,
      MINIMUM_RECOMMENDATIONS.practiceQuestions,
      'practiceQuestions'
    );
    if (warning) warnings.push(warning);
  }
  
  // Validar que arrays são realmente arrays
  const arrayFields = ['vocabulary', 'grammar', 'expressions', 'practiceQuestions', 'culturalNotes'];
  for (const field of arrayFields) {
    if (field in enrichedContent && !Array.isArray(enrichedContent[field])) {
      warnings.push(`Campo "${field}" deve ser um array, recebido: ${typeof enrichedContent[field]}`);
    }
  }
  
  return buildValidationResult(missingFields, unexpectedFields, warnings);
}

/**
 * Exportar validador no formato esperado pelo validateContent
 */
export default validateLanguageStructure;
