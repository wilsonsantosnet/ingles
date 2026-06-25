/**
 * Technology Schema Validator - Validador para categorias de tecnologia/certificações
 * 
 * Valida estruturas de conteúdo enriquecido para categorias do tipo "technology".
 * Estrutura esperada: topics, concepts, commands, scenarios, exercises, examTips
 */

import {
  checkRequiredFields,
  checkForbiddenFields,
  checkMinimumCount,
  buildValidationResult
} from './schemaValidator.js';

/**
 * Campos obrigatórios para categorias de tecnologia
 */
const REQUIRED_FIELDS = [
  'summary',
  'topics',
  'concepts',
  'commands',
  'scenarios',
  'exercises',
  'examTips'
];

/**
 * Campos proibidos para categorias de tecnologia (pertencem a outros tipos)
 */
const FORBIDDEN_FIELDS = [
  'vocabulary',      // campo de language
  'grammar',         // campo de language
  'expressions',     // campo de language
  'culturalNotes',   // campo de language
  'pronunciation',   // campo de language
  'partOfSpeech'     // campo de language
];

/**
 * Recomendações de quantidade mínima de itens
 */
const MINIMUM_RECOMMENDATIONS = {
  topics: 1,        // Pelo menos 1 tópico técnico
  concepts: 1,      // Pelo menos 1 conceito técnico
  exercises: 5,     // Pelo menos 5 exercícios recomendados (mais que language)
  scenarios: 1      // Pelo menos 1 cenário prático
};

/**
 * Valida estrutura de conteúdo enriquecido para tecnologia
 * @param {Object} enrichedContent - Objeto enriched do JSON da lição
 * @returns {ValidationResult}
 */
export function validateTechnologyStructure(enrichedContent) {
  const warnings = [];
  
  // Verificar campos obrigatórios
  const missingFields = checkRequiredFields(enrichedContent, REQUIRED_FIELDS);
  
  // Verificar campos proibidos (não devem estar presentes)
  const unexpectedFields = checkForbiddenFields(enrichedContent, FORBIDDEN_FIELDS);
  
  // Verificar contagens mínimas recomendadas (se campo existir)
  if (enrichedContent.topics) {
    const warning = checkMinimumCount(
      enrichedContent.topics,
      MINIMUM_RECOMMENDATIONS.topics,
      'topics'
    );
    if (warning) warnings.push(warning);
  }
  
  if (enrichedContent.concepts) {
    const warning = checkMinimumCount(
      enrichedContent.concepts,
      MINIMUM_RECOMMENDATIONS.concepts,
      'concepts'
    );
    if (warning) warnings.push(warning);
  }
  
  if (enrichedContent.exercises) {
    const warning = checkMinimumCount(
      enrichedContent.exercises,
      MINIMUM_RECOMMENDATIONS.exercises,
      'exercises'
    );
    if (warning) warnings.push(warning);
  }
  
  if (enrichedContent.scenarios) {
    const warning = checkMinimumCount(
      enrichedContent.scenarios,
      MINIMUM_RECOMMENDATIONS.scenarios,
      'scenarios'
    );
    if (warning) warnings.push(warning);
  }
  
  // Validar que arrays são realmente arrays
  const arrayFields = ['topics', 'concepts', 'commands', 'scenarios', 'exercises', 'examTips'];
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
export default validateTechnologyStructure;
