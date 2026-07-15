import OpenAI, { AzureOpenAI } from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { config } from './config.js';
import { validateContent } from './schemas/schemaValidator.js';
import validateLanguageStructure from './schemas/languageSchema.js';
import validateTechnologyStructure from './schemas/technologySchema.js';

function getLlmProvider() {
  return (config.llm?.provider || 'azure_openai').toLowerCase();
}

function parseJsonFromLlmContent(content) {
  const cleanedContent = String(content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleanedContent);
  } catch {
    // Fallback: tenta extrair apenas o bloco JSON quando o modelo inclui texto extra.
    const objectStart = cleanedContent.indexOf('{');
    const objectEnd = cleanedContent.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      const objectCandidate = cleanedContent.slice(objectStart, objectEnd + 1);
      const repairedObject = attemptJsonRepair(objectCandidate);
      if (repairedObject) {
        return repairedObject;
      }
    }

    const arrayStart = cleanedContent.indexOf('[');
    const arrayEnd = cleanedContent.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      const arrayCandidate = cleanedContent.slice(arrayStart, arrayEnd + 1);
      const repairedArray = attemptJsonRepair(arrayCandidate);
      if (repairedArray) {
        return repairedArray;
      }
    }

    throw new Error('Resposta da IA não contém JSON parseável');
  }
}

function tryParseJson(candidate) {
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function attemptJsonRepair(rawJson) {
  const candidates = [];

  // Candidato original
  candidates.push(rawJson);

  // Remove caracteres de controle ilegais (mantendo \n, \r, \t)
  candidates.push(rawJson.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''));

  // Remove trailing commas antes de } ou ]
  candidates.push(rawJson.replace(/,\s*([}\]])/g, '$1'));

  // Combinação: controle + trailing comma
  candidates.push(
    rawJson
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/,\s*([}\]])/g, '$1')
  );

  // Normaliza aspas “smart quotes”
  candidates.push(
    rawJson
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, '$1')
  );

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function safeJsonPreview(value, maxLength = 2500) {
  try {
    const serialized = JSON.stringify(value, null, 2);
    if (!serialized) return '';
    return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}... [truncated]` : serialized;
  } catch {
    return '[unserializable]';
  }
}

function logFoundryRawResponse(label, response) {
  const preview = {
    id: response?.id,
    model: response?.model,
    object: response?.object,
    usage: response?.usage,
    choices: response?.choices?.map(choice => ({
      index: choice?.index,
      finish_reason: choice?.finish_reason,
      message: choice?.message
    })),
    output: response?.output,
    output_text: response?.output_text
  };

  console.warn(`🧾 Raw Foundry response (${label}):`);
  console.warn(safeJsonPreview(preview));
}

function extractContentFromFoundryResponse(response) {
  const choice = response?.choices?.[0];
  const message = choice?.message;

  if (typeof message?.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message?.content)) {
    const parts = message.content
      .map(part => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    if (parts) {
      return parts;
    }
  }

  if (typeof message?.refusal === 'string' && message.refusal.trim()) {
    return message.refusal.trim();
  }

  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  return '';
}

function extractContentFromResponsesApi(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (Array.isArray(response?.output)) {
    const outputText = response.output
      .flatMap(item => (Array.isArray(item?.content) ? item.content : []))
      .map(part => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    if (outputText) {
      return outputText;
    }
  }

  return '';
}

function createFoundryClient() {
  const { endpoint, apiKey } = config.foundryOpenAI;

  if (!endpoint) {
    throw new Error('FOUNDRY_OPENAI_ENDPOINT não configurado');
  }

  if (!apiKey) {
    throw new Error('FOUNDRY_OPENAI_KEY não configurado');
  }

  // Define também api-key em header para compatibilidade com endpoints OpenAI-compat do Azure.
  return new OpenAI({
    baseURL: endpoint,
    apiKey,
    defaultHeaders: {
      'api-key': apiKey
    }
  });
}

function getFoundryCompletionConfig() {
  const rawTokens = Number(config.foundryOpenAI?.maxCompletionTokens);
  const maxCompletionTokens = Number.isFinite(rawTokens) && rawTokens > 0 ? Math.floor(rawTokens) : 16384;

  const effortRaw = String(config.foundryOpenAI?.reasoningEffort || '').toLowerCase().trim();
  const allowedEfforts = new Set(['low', 'medium', 'high']);
  const reasoningEffort = allowedEfforts.has(effortRaw) ? effortRaw : null;

  return {
    maxCompletionTokens,
    reasoningEffort
  };
}

function isReasoningEffortUnsupported(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('reasoning_effort') || message.includes('reasoning.effort') || message.includes('unknown parameter');
}

async function createFoundryChatCompletion(client, payload) {
  const { maxCompletionTokens, reasoningEffort } = getFoundryCompletionConfig();
  const request = {
    ...payload,
    max_completion_tokens: maxCompletionTokens
  };

  if (reasoningEffort) {
    request.reasoning_effort = reasoningEffort;
  }

  try {
    return await client.chat.completions.create(request);
  } catch (error) {
    if (!reasoningEffort || !isReasoningEffortUnsupported(error)) {
      throw error;
    }

    console.warn('⚠️ Endpoint não aceitou reasoning_effort em chat.completions; retry sem esse parâmetro.');
    const fallbackRequest = { ...request };
    delete fallbackRequest.reasoning_effort;
    return await client.chat.completions.create(fallbackRequest);
  }
}

async function createFoundryResponse(client, payload) {
  const { maxCompletionTokens, reasoningEffort } = getFoundryCompletionConfig();
  const request = {
    ...payload,
    max_output_tokens: maxCompletionTokens
  };

  if (reasoningEffort) {
    request.reasoning = { effort: reasoningEffort };
  }

  try {
    return await client.responses.create(request);
  } catch (error) {
    if (!reasoningEffort || !isReasoningEffortUnsupported(error)) {
      throw error;
    }

    console.warn('⚠️ Endpoint não aceitou reasoning.effort em responses.create; retry sem esse parâmetro.');
    const fallbackRequest = { ...request };
    delete fallbackRequest.reasoning;
    return await client.responses.create(fallbackRequest);
  }
}

async function repairJsonWithFoundry(client, deployment, rawContent) {
  const snippet = String(rawContent || '').trim();
  if (!snippet) return null;

  const repairPrompt = `Você é um corretor de JSON.

TAREFA:
Corrigir o conteúdo abaixo para JSON VÁLIDO.

REGRAS:
- Retorne APENAS JSON válido
- Não use markdown
- Não adicione explicações
- Preserve ao máximo a estrutura e os campos originais

CONTEÚDO:
${snippet}`;

  const repairResponse = await createFoundryResponse(client, {
    model: deployment,
    input: repairPrompt
  });

  const repairedText = extractContentFromResponsesApi(repairResponse) || extractContentFromFoundryResponse(repairResponse);
  if (!repairedText) {
    logFoundryRawResponse('responses.create:json-repair-empty', repairResponse);
    return null;
  }

  try {
    return parseJsonFromLlmContent(repairedText);
  } catch (error) {
    console.warn('⚠️ Falha ao parsear JSON reparado via Foundry:', error.message);
    return null;
  }
}

/**
 * Enriquece o conteúdo da aula usando Azure OpenAI
 * Detecta o tipo de categoria e usa a estratégia apropriada
 * @param {Object} lesson - Dados da aula
 * @param {Object} category - Categoria da aula (com campo type)
 * @returns {Promise<Object>} Conteúdo enriquecido
 */
export async function enrichWithLLM(lesson, category) {
  console.log(`\n🤖 Enriquecendo aula: ${lesson.title}...`);
  
  // FR-008: Default "language" se type não especificado (backward compatibility)
  const categoryType = category?.type || 'language';
  console.log(`📂 Tipo de categoria: ${categoryType}`);
  
  try {
    // Dispatch por tipo de categoria
    let enrichedLesson;
    
    switch (categoryType) {
      case 'language':
        enrichedLesson = await enrichLanguageContent(lesson, category);
        break;
      
      case 'technology':
        enrichedLesson = await enrichTechnologyContent(lesson, category);
        break;
      
      default:
        // FR-009: Reportar erro para tipo desconhecido
        throw new Error(`❌ Tipo de categoria desconhecido: "${categoryType}". Tipos válidos: language, technology`);
    }
    
    return enrichedLesson;
    
  } catch (error) {
    console.error('❌ Erro ao enriquecer com LLM:', error.message);
    return {
      ...lesson,
      enriched: null,
      error: error.message,
      status: 'error'
    };
  }
}

/**
 * Extrai links/URLs do conteúdo bruto e retorna como materiais de apoio
 * @param {string} rawContent - Conteúdo bruto da aula
 * @returns {Array} Array de referências extraídas
 */
function extractLinksFromRawContent(rawContent) {
  if (!rawContent) return [];

  // Regex para capturar URLs completas (http/https)
  const urlRegex = /https?:\/\/[^\s\]\)\"\'<>,]+/g;
  const matches = rawContent.match(urlRegex) || [];

  // Deduplica e limpa URLs (remove pontuação final como . , ; )
  const uniqueUrls = [...new Set(matches.map(url => url.replace(/[.,;:!?)]+$/, '')))];

  return uniqueUrls.map(url => {
    // Tentar inferir título a partir da URL
    let title = url;
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        // Pega últimas partes do path e formata como título
        const lastParts = pathParts.slice(-2).join(' / ');
        title = lastParts.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    } catch { /* mantém url como título */ }

    // Classifica o tipo baseado no domínio
    let type = 'reference';
    if (url.includes('learn.microsoft.com')) type = 'documentation';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) type = 'video';
    else if (url.includes('github.com')) type = 'reference';
    else if (url.includes('tutorial') || url.includes('guide')) type = 'tutorial';

    return { title, url, type };
  });
}

/**
 * Enriquece conteúdo para categorias de idioma (language)
 * Mantém funcionalidade 100% backward compatible
 * @param {Object} lesson - Dados da aula
 * @param {Object} category - Categoria da aula
 * @returns {Promise<Object>} Conteúdo enriquecido
 */
async function enrichLanguageContent(lesson, category) {
  console.log('🌐 Usando prompt de idiomas...');
  
  const prompt = createLanguagePrompt(lesson);
  const rawEnrichedContent = await callAzureOpenAI(prompt);
  const enrichedContent = normalizeLanguageEnrichedContent(rawEnrichedContent);
  
  // Extrair links do conteúdo bruto (determinístico)
  const extractedLinks = extractLinksFromRawContent(lesson.rawContent);
  if (extractedLinks.length > 0) {
    console.log(`🔗 ${extractedLinks.length} link(s) extraído(s) do conteúdo bruto`);
  }
  
  // Merge: links extraídos via regex + links gerados pela IA (sem duplicar)
  const aiRefs = enrichedContent.references || [];
  const allUrls = new Set(aiRefs.map(r => r.url));
  const mergedReferences = [...aiRefs];
  for (const link of extractedLinks) {
    if (!allUrls.has(link.url)) {
      mergedReferences.push(link);
      allUrls.add(link.url);
    }
  }
  enrichedContent.references = mergedReferences;
  enrichedContent.supportMaterials = mergedReferences;
  
  // Validar estrutura de idioma
  console.log('🔍 Validando estrutura de idioma...');
  const validation = validateContent({ enriched: enrichedContent }, validateLanguageStructure);
  
  logValidationResults(validation);
  
  // Atualizar título se a IA gerou um
  const generatedTitle = enrichedContent.title;
  if (generatedTitle && generatedTitle.trim()) {
    console.log(`📝 Título gerado: ${generatedTitle}`);
  }

  return {
    ...lesson,
    ...(generatedTitle && generatedTitle.trim() ? { title: generatedTitle.trim() } : {}),
    enriched: enrichedContent,
    enrichedAt: new Date().toISOString(),
    status: validation.isValid ? 'enriched' : 'requires-review',
    validation: {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    }
  };
}

/**
 * Enriquece conteúdo para categorias de tecnologia (technology)
 * @param {Object} lesson - Dados da aula
 * @param {Object} category - Categoria da aula
 * @returns {Promise<Object>} Conteúdo enriquecido
 */
async function enrichTechnologyContent(lesson, category) {
  console.log('💻 Usando prompt de tecnologia...');
  
  const prompt = createTechnologyPrompt(lesson);
  const enrichedContent = await callAzureOpenAI(prompt);
  
  // Extrair links do conteúdo bruto (determinístico)
  const extractedLinks = extractLinksFromRawContent(lesson.rawContent);
  if (extractedLinks.length > 0) {
    console.log(`🔗 ${extractedLinks.length} link(s) extraído(s) do conteúdo bruto`);
  }
  
  // Merge: links extraídos via regex + links gerados pela IA (sem duplicar)
  const aiRefs = enrichedContent.references || [];
  const allUrls = new Set(aiRefs.map(r => r.url));
  const mergedReferences = [...aiRefs];
  for (const link of extractedLinks) {
    if (!allUrls.has(link.url)) {
      mergedReferences.push(link);
      allUrls.add(link.url);
    }
  }
  enrichedContent.references = mergedReferences;
  enrichedContent.supportMaterials = mergedReferences;
  
  // Validar estrutura de tecnologia
  console.log('🔍 Validando estrutura de tecnologia...');
  const validation = validateContent({ enriched: enrichedContent }, validateTechnologyStructure);
  
  logValidationResults(validation);
  
  // Atualizar título se a IA gerou um
  const generatedTitle = enrichedContent.title;
  if (generatedTitle && generatedTitle.trim()) {
    console.log(`📝 Título gerado: ${generatedTitle}`);
  }

  return {
    ...lesson,
    ...(generatedTitle && generatedTitle.trim() ? { title: generatedTitle.trim() } : {}),
    enriched: enrichedContent,
    enrichedAt: new Date().toISOString(),
    status: validation.isValid ? 'enriched' : 'requires-review',
    validation: {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    }
  };
}

/**
 * Loga resultados de validação no console
 * @param {Object} validation - Resultado da validação
 */
function logValidationResults(validation) {
  if (validation.isValid) {
    console.log('✅ Validação PASSOU - estrutura correta');
  } else {
    console.warn('⚠️ Validação FALHOU - estrutura incorreta');
  }
  
  if (validation.errors.length > 0) {
    console.error('🚨 Erros:');
    validation.errors.forEach(err => console.error(`   - ${err}`));
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Avisos:');
    validation.warnings.forEach(warn => console.warn(`   - ${warn}`));
  }
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function normalizeLanguageEnrichedContent(rawContent) {
  const normalized = (rawContent && typeof rawContent === 'object') ? { ...rawContent } : {};

  // Alguns modelos retornam "exercises" para idioma; convertemos para o contrato esperado.
  if (!normalized.practiceQuestions && normalized.exercises) {
    normalized.practiceQuestions = normalized.exercises;
  }

  normalized.vocabulary = ensureArray(normalized.vocabulary);
  normalized.grammar = ensureArray(normalized.grammar);
  normalized.expressions = ensureArray(normalized.expressions);
  normalized.practiceQuestions = ensureArray(normalized.practiceQuestions);
  normalized.culturalNotes = ensureArray(normalized.culturalNotes);

  if ('studyTips' in normalized) {
    normalized.studyTips = ensureArray(normalized.studyTips);
  }

  if ('mainTopics' in normalized) {
    normalized.mainTopics = ensureArray(normalized.mainTopics);
  }

  return normalized;
}

/**
 * Cria o prompt para categorias de idiomas
 * @param {Object} lesson - Dados da aula
 * @returns {string} Prompt formatado
 */
function createLanguagePrompt(lesson) {
  return `Você é um assistente especializado em ensino de inglês. Analise o conteúdo da aula abaixo e enriqueça-o com informações úteis para estudo.

CONTEÚDO DA AULA:
${lesson.rawContent}

TAREFA:
Retorne um JSON estruturado com o seguinte formato:

{
  "title": "Título curto e descritivo da aula (máx 80 caracteres) em português - resuma o foco principal",
  "summary": "Resumo conciso da aula (2-3 frases)",
  "mainTopics": ["tópico 1", "tópico 2", ...],
  "vocabulary": [
    {
      "word": "palavra",
      "translation": "tradução (se fornecida no documento, use exatamente como aparece)",
      "definition": "definição em inglês",
      "examples": ["PRIORIDADE: use as frases de exemplo que aparecem no documento original", "Se necessário, adicione mais exemplos"],
      "pronunciation": "pronúncia (IPA se possível, ou se fornecida no documento)",
      "partOfSpeech": "noun/verb/adjective/etc",
      "synonyms": ["sinônimo 1", "sinônimo 2"],
      "difficulty": "basic/intermediate/advanced"
    }
  ],
  "grammar": [
    {
      "topic": "tópico gramatical",
      "explanation": "explicação clara",
      "rules": ["regra 1", "regra 2"],
      "examples": ["USE as frases de exemplo que aparecem no documento original"],
      "commonMistakes": ["erro comum 1", "erro comum 2"]
    }
  ],
  "expressions": [
    {
      "expression": "expressão idiomática",
      "meaning": "significado (se fornecido no documento, use exatamente)",
      "usage": "contexto de uso",
      "examples": ["USE as frases que aparecem no documento original"]
    }
  ],
  "practiceQuestions": [
    {
      "question": "pergunta ou exercício",
      "answer": "resposta esperada",
      "explanation": "explicação da resposta",
      "type": "multiple-choice/fill-in-blank/translation/etc",
      "tense": "tempo verbal relacionado (ex: Simple Past, Present Perfect, Past Continuous, etc) - identifique com base no contexto da aula"
    }
  ],
  "culturalNotes": ["nota cultural 1", "nota cultural 2"],
  "studyTips": ["dica 1", "dica 2"],
  "originalExamples": [
    "TODAS as frases de exemplo em inglês presentes no documento original",
    "Inclua diálogos, traduções de português para inglês, e quaisquer frases práticas",
    "Mantenha na ordem que aparecem no documento"
  ],
  "references": [
    {
      "title": "Título descritivo do link",
      "url": "URL completa exatamente como aparece no documento",
      "type": "documentation/tutorial/reference/video"
    }
  ]
}

INSTRUÇÕES CRÍTICAS - LEIA COM ATENÇÃO:

0. TITLE (Título da Aula):
   - Gere um título CURTO e DESCRITIVO (máximo 80 caracteres) em português
   - O título deve resumir o foco principal da aula
   - Exemplos: "Present Perfect e Vocabulário de Viagens", "Verbos Irregulares e Pronúncia"

1. ⚠️ EXTRAÇÃO DE VOCABULÁRIO - REGRA OBRIGATÓRIA:
   VOCÊ DEVE EXTRAIR **CADA PALAVRA/EXPRESSÃO** QUE APARECER COM TRADUÇÃO NO DOCUMENTO.
   
   a) **VERBOS IRREGULARES** (formato: "verb – past – past participle: tradução"):
      - Se aparece "ring – rang – rung: tocar, soar" → crie entrada com word="ring", translation="tocar, soar"
      - Se aparece "sing – sang – sung: cantar" → crie entrada com word="sing", translation="cantar"
      - Se aparece "buy – bought – bought" → crie entrada com word="buy", translation="comprar"
      - SEMPRE inclua a conjugação irregular nos examples (ex: "ring - rang - rung")
   
   b) **PALAVRAS COM TRADUÇÃO** (formato: "palavra: tradução"):
      - Se aparece "jam: emperrar" → crie entrada com word="jam", translation="emperrar"
      - Se aparece "global warming: aquecimento global" → crie entrada
   
   c) **PRONÚNCIAS** (formato: "word - / pronúncia /"):
      - Se aparece "stopped - / stópt /" → crie entrada com pronunciation="/stópt/"
   
   d) **PARES DE PALAVRAS SIMILARES** (formato: "word1 – word2"):
      - Se aparece "where – wear" → crie uma entrada explicando a diferença
   
   e) **EXPRESSÕES IDIOMÁTICAS**:
      - "do the dishes", "in a row", etc → adicione em "expressions" array

   📌 REGRA DE OURO: Se está escrito em inglês com tradução/explicação, DEVE estar no vocabulary ou expressions!

2. USE AS FRASES ORIGINAIS DO DOCUMENTO:
   - SEMPRE priorize os exemplos que já estão no documento
   - Frases como "Daniel ate pasta yesterday", "He didn't eat rice, beans and meat" devem ser usadas
   - Mantenha a autenticidade das frases de prática do professor

3. SEÇÃO originalExamples:
   - Inclua TODAS as frases completas em inglês do documento COM suas traduções em português
   - Formato: "English sentence (Tradução em português)"
   - Exemplo: "Daniel ate pasta yesterday. (Daniel comeu massa ontem.)"
   - Mantenha diálogos com suas traduções
   - Esta seção serve para o aluno rever as frases trabalhadas em aula

4. TRADUÇÃO NO VOCABULÁRIO:
   - SEMPRE preencha o campo "translation" nas palavras do vocabulário
   - NUNCA deixe "translation" como null ou vazio
   - Se aparecer "drunk: bêbado" no documento, use "bêbado" como translation
   - Se não houver tradução explícita, forneça a tradução mais comum em português

5. NÃO LIMITE A QUANTIDADE:
   - Se o documento tem 20 palavras de vocabulário, inclua todas as 20
   - Se tem 15 expressões, inclua todas as 15

6. REFERENCES (Links e Referências):
   - Extraia TODOS os URLs/links presentes no documento original (https://...)
   - Para cada link, crie um título descritivo baseado no contexto
   - Preserve a URL EXATAMENTE como aparece no documento, NÃO modifique
   - Se não houver links no documento, deixe o array vazio []

IMPORTANTE:
- Retorne APENAS o JSON, sem markdown ou texto adicional
- Seja preciso e educativo
- Use o conteúdo original como base principal
- Priorize informações práticas para memorização
`;
}

/**
 * Cria o prompt para categorias de tecnologia
 * Estrutura: topics, concepts, commands, scenarios, exercises, examTips
 * @param {Object} lesson - Dados da aula
 * @returns {string} Prompt formatado
 */
function createTechnologyPrompt(lesson) {
  return `Você é um expert em ensino de tecnologia e preparação para certificações. Analise o conteúdo técnico abaixo e estruture-o para estudo eficiente.

CONTEÚDO DA AULA:
${lesson.rawContent}

TAREFA:
Retorne um JSON estruturado com EXATAMENTE este formato:

{
  "title": "Título curto e descritivo da aula (máx 80 caracteres) - resuma o foco principal",
  "summary": "Resumo técnico conciso da aula (2-3 frases descrevendo o conteúdo principal)",
  "topics": [
    {
      "title": "nome do tópico técnico",
      "description": "descrição clara do tópico",
      "category": "categoria superior (ex: Compute, Storage, Network)",
      "importance": "high/medium/low"
    }
  ],
  "concepts": [
    {
      "concept": "termo técnico ou conceito",
      "definition": "definição técnica clara",
      "examples": ["exemplo prático 1", "exemplo de uso 2"],
      "relatedConcepts": ["conceito relacionado 1", "conceito relacionado 2"],
      "difficulty": "beginner/intermediate/advanced"
    }
  ],
  "commands": [
    {
      "command": "comando literal (ex: az vm create, New-AzVM)",
      "description": "o que o comando faz",
      "syntax": "sintaxe completa com parâmetros",
      "examples": ["exemplo de uso 1", "exemplo com flags/parâmetros"],
      "platform": "Azure CLI/PowerShell/Portal/ARM/Terraform/etc"
    }
  ],
  "scenarios": [
    {
      "scenario": "título do cenário prático",
      "problem": "descrição completa do problema ou caso de uso",
      "solution": "solução passo-a-passo",
      "explanation": "por que a solução funciona (fundamento técnico)"
    }
  ],
  "exercises": [
    {
      "type": "scenario-based/command/concept/troubleshooting",
      "question": "pergunta de exercício",
      "answer": "resposta correta esperada",
      "hint": "dica para resolução",
      "topic": "tópico relacionado"
    }
  ],
  "examTips": [
    {
      "tip": "dica importante para prova/certificação",
      "relevance": "por que isso é importante para o exame",
      "topic": "tópico relacionado (opcional)"
    }
  ],
  "references": [
    {
      "title": "Título descritivo do link (ex: Documentação oficial de Availability Sets)",
      "url": "URL completa exatamente como aparece no documento (ex: https://learn.microsoft.com/...)",
      "type": "documentation/tutorial/reference/video"
    }
  ]
}

INSTRUÇÕES CRÍTICAS:

1. TOPICS (Tópicos Técnicos):
   - Identifique os tópicos principais do documento
   - Use categorias como: Compute, Storage, Network, Security, Monitoring, Identity
   - Marque importance=high para tópicos críticos para certificação

2. CONCEPTS (Conceitos Técnicos):
   - Extraia TODOS os termos técnicos importantes
   - Inclua acrônimos e suas expansões (ex: VM = Virtual Machine)
   - Conecte conceitos relacionados para criar mapa mental
   - Diferencie níveis de dificuldade

3. COMMANDS (Comandos/Código):
   - Inclua comandos mencionados no documento
   - Forneça sintaxe completa (não apenas nome do comando)
   - Especifique a plataforma (CLI, PowerShell, Portal UI, etc)
   - Se não houver comandos explícitos, pode deixar array vazio []

4. SCENARIOS (Cenários Práticos):
   - Crie cenários realistas baseados no conteúdo
   - Foque em troubleshooting e casos de uso práticos
   - Explique o "porquê" da solução (não apenas o "como")

5. EXERCISES (Exercícios):
   - Crie no mínimo 5 exercícios práticos
   - Varie os tipos: conceitual, comando, cenário, troubleshooting
   - Graduar dificuldade (fácil → difícil)
   - Sempre forneça hints úteis

6. EXAM TIPS (Dicas de Prova):
   - Destaque pontos frequentemente cobrados em certificações
   - Inclua "pegadinhas" comuns
   - Aponte diferenças sutis entre opções semelhantes

7. REFERENCES (Links e Referências):
   - Extraia TODOS os URLs/links presentes no documento original (https://...)
   - Para cada link, crie um título descritivo baseado no contexto em que ele aparece
   - Preserve a URL EXATAMENTE como aparece no documento, NÃO modifique
   - Classifique o tipo: documentation, tutorial, reference, video
   - Se não houver links no documento, tente sugerir 2-3 links oficiais relevantes da Microsoft Learn

8. TITLE (Título da Aula):
   - Gere um título CURTO e DESCRITIVO (máximo 80 caracteres)
   - O título deve resumir o foco principal da aula
   - Use português para o título
   - Exemplos: "Availability Sets e Fault Domains no Azure", "VPN Gateway e Conectividade Híbrida"

IMPORTANTE:
- Retorne APENAS o JSON, sem markdown ou texto adicional
- Todos os arrays devem existir (podem estar vazios [] se não aplicável)
- Seja técnico e preciso
- Use terminologia oficial da tecnologia
- Priorize informações práticas e aplicáveis para estudo
`;
}

/**
 * Gera conteúdo adicional para uma aula usando prompt customizado do usuário
 * @param {Object} lesson - Dados completos da aula (incluindo enriched)
 * @param {Object} category - Categoria da aula
 * @param {string} userPrompt - Prompt personalizado do usuário
 * @returns {Promise<Object>} Conteúdo gerado pela IA
 */
export async function generateWithPrompt(lesson, category, userPrompt, imageBase64 = null, imageMimeType = null) {
  console.log(`\n🧠 Gerando conteúdo com prompt customizado para: ${lesson.title}...`);
  if (imageBase64) {
    console.log(`📸 Imagem incluída no contexto (${imageMimeType})`);
  }

  const categoryType = category?.type || 'language';

  const systemContext = `Você é um assistente especializado em criação de conteúdo educacional.
Tipo de categoria: ${categoryType}
Categoria: ${category?.name || 'N/A'}

Abaixo estão TODOS os dados disponíveis da aula atual (em JSON). Use esses dados como contexto para gerar o que o usuário pedir.

=== DADOS DA AULA ===
${JSON.stringify(lesson, null, 2)}
=== FIM DOS DADOS ===

${imageBase64 ? 'IMPORTANTE: Uma imagem foi fornecida pelo usuário. Analise a imagem em conjunto com o prompt e os dados da aula para gerar o conteúdo solicitado.\n' : ''}
INSTRUÇÕES:
- Use os dados da aula como base/contexto para gerar novos conteúdos
- O conteúdo gerado deve ser complementar à aula existente
${imageBase64 ? '- Analise o conteúdo da imagem e use as informações nela como parte do contexto\n' : ''}- Retorne SEMPRE um JSON válido com a seguinte estrutura:
{
  "generatedContent": {
    "title": "título descritivo do conteúdo gerado",
    "type": "exercise|explanation|summary|examples|custom",
    "content": (conteúdo gerado - pode ser string, array ou objeto dependendo do pedido)
  }
}
- Se o pedido envolve exercícios, use formato de array com question/answer/explanation
- Se envolve explicação, use texto formatado
- Seja técnico e preciso
- Retorne APENAS o JSON, sem markdown ou texto adicional`;

  const fullPrompt = `${systemContext}\n\n=== PEDIDO DO USUÁRIO ===\n${userPrompt}`;

  try {
    let generatedContent;
    if (imageBase64) {
      // Use vision API with image
      generatedContent = await callAzureOpenAIWithImage(fullPrompt, imageBase64, imageMimeType);
    } else {
      generatedContent = await callAzureOpenAI(fullPrompt);
    }
    return {
      ...generatedContent,
      generatedAt: new Date().toISOString(),
      userPrompt: userPrompt
    };
  } catch (error) {
    console.error('❌ Erro ao gerar conteúdo com prompt:', error.message);
    throw error;
  }
}

/**
 * Gera preview rápido de vocabulário para cadastro manual de termo/frase
 * @param {string} word - Termo ou frase em inglês
 * @returns {Promise<Object>} Estrutura de vocabulário pronta para salvar
 */
export async function generateQuickVocabulary(word) {
  const normalizedWord = (word || '').trim();

  if (!normalizedWord) {
    throw new Error('Palavra é obrigatória');
  }

  const prompt = `Você é um assistente de ensino de inglês.

TAREFA:
Gerar um JSON para o termo/frase abaixo, com foco em estudo rápido para flashcards.

TERMO_OU_FRASE:
${normalizedWord}

FORMATO DE SAÍDA (retorne APENAS JSON):
{
  "word": "palavra original em inglês",
  "translation": "tradução principal em português brasileiro",
  "definition": "definição curta em inglês",
  "examples": [
    "exemplo 1 em inglês",
    "exemplo 2 em inglês",
    "exemplo 3 em inglês"
  ],
  "pronunciation": "pronúncia simples ou IPA",
  "partOfSpeech": "noun|verb|adjective|adverb|expression|other",
  "synonyms": ["sinônimo 1", "sinônimo 2"],
  "difficulty": "basic|intermediate|advanced"
}

REGRAS:
- Máximo de 5 exemplos
- Exemplos devem ser curtos e naturais
- Não inclua markdown
- Não inclua explicações fora do JSON
- Se for uma frase completa, mantenha a frase completa no campo word e escolha partOfSpeech="expression" ou "other"`;

  const generated = await callAzureOpenAI(prompt);

  return {
    word: generated.word || normalizedWord,
    translation: generated.translation || '',
    definition: generated.definition || '',
    examples: Array.isArray(generated.examples) ? generated.examples.slice(0, 5) : [],
    pronunciation: generated.pronunciation || '',
    partOfSpeech: generated.partOfSpeech || 'other',
    synonyms: Array.isArray(generated.synonyms) ? generated.synonyms : [],
    difficulty: generated.difficulty || 'intermediate'
  };
}

/**
 * Gera preview de vocabulário para uma lista de termos
 * @param {string[]} terms - Lista de termos/frases em inglês
 * @returns {Promise<Array>} Lista de estruturas de vocabulário prontas para salvar
 */
export async function generateQuickVocabularyBatch(terms) {
  const normalizedTerms = Array.isArray(terms)
    ? terms.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  if (!normalizedTerms.length) {
    return [];
  }

  const prompt = `Você é um assistente de ensino de inglês.

TAREFA:
Para cada termo/frase abaixo, gerar um item de vocabulário em JSON.

TERMOS:
${normalizedTerms.map((term, index) => `${index + 1}. ${term}`).join('\n')}

FORMATO DE SAÍDA (retorne APENAS JSON):
{
  "items": [
    {
      "word": "palavra/frase original em inglês",
      "translation": "tradução principal em português brasileiro",
      "definition": "definição curta em inglês",
      "examples": ["exemplo 1", "exemplo 2"],
      "pronunciation": "pronúncia simples ou IPA",
      "partOfSpeech": "noun|verb|adjective|adverb|expression|other",
      "synonyms": ["sinônimo 1", "sinônimo 2"],
      "difficulty": "basic|intermediate|advanced"
    }
  ]
}

REGRAS:
- Retorne exatamente um item para cada termo enviado
- Preserve o termo original no campo "word"
- Sempre preencha "translation"
- Máximo de 3 exemplos por item
- Não inclua markdown
- Não inclua explicações fora do JSON`;

  const generated = await callAzureOpenAI(prompt);
  const rawItems = Array.isArray(generated?.items) ? generated.items : [];

  const normalizedItems = rawItems
    .map((item) => ({
      word: String(item?.word || '').trim(),
      translation: String(item?.translation || '').trim(),
      definition: String(item?.definition || '').trim(),
      examples: Array.isArray(item?.examples) ? item.examples.slice(0, 3).map((example) => String(example || '').trim()).filter(Boolean) : [],
      pronunciation: String(item?.pronunciation || '').trim(),
      partOfSpeech: String(item?.partOfSpeech || 'other').trim() || 'other',
      synonyms: Array.isArray(item?.synonyms) ? item.synonyms.map((synonym) => String(synonym || '').trim()).filter(Boolean) : [],
      difficulty: String(item?.difficulty || 'intermediate').trim() || 'intermediate'
    }))
    .filter((item) => item.word && item.translation);

  // Fallback para garantir saída útil mesmo quando a IA retorna menos itens do que o solicitado.
  if (normalizedItems.length < normalizedTerms.length) {
    const byWord = new Map(normalizedItems.map((item) => [item.word.toLocaleLowerCase('pt-BR'), item]));
    const completedItems = [];

    for (const term of normalizedTerms) {
      const key = term.toLocaleLowerCase('pt-BR');
      const existing = byWord.get(key);
      if (existing) {
        completedItems.push(existing);
        continue;
      }

      const single = await generateQuickVocabulary(term);
      completedItems.push(single);
    }

    return completedItems;
  }

  return normalizedItems.slice(0, normalizedTerms.length);
}

/**
 * Gera vocabulário derivado de uma frase completa
 * @param {string} sentence - Frase em inglês
 * @param {number} maxWords - Limite de palavras derivadas
 * @returns {Promise<Array>} Lista de itens de vocabulário
 */
export async function generateSentenceVocabulary(sentence, maxWords = 8) {
  const normalizedSentence = (sentence || '').trim();

  if (!normalizedSentence) {
    return [];
  }

  const prompt = `Você é um assistente de ensino de inglês.

TAREFA:
Extrair as palavras mais importantes da frase abaixo e retornar vocabulário útil para estudo.

FRASE:
${normalizedSentence}

FORMATO DE SAÍDA (retorne APENAS JSON):
{
  "vocabulary": [
    {
      "word": "palavra base em inglês",
      "translation": "tradução em português brasileiro",
      "definition": "definição curta em inglês",
      "examples": ["um exemplo curto em inglês"],
      "partOfSpeech": "noun|verb|adjective|adverb|expression|other",
      "difficulty": "basic|intermediate|advanced"
    }
  ]
}

REGRAS:
- Retorne no máximo ${maxWords} palavras
- Não inclua nomes próprios, artigos isolados, ou pronomes simples sem valor de estudo
- Não inclua a frase inteira como palavra
- Não inclua markdown
- Não inclua explicações fora do JSON`;

  const generated = await callAzureOpenAI(prompt);
  const items = Array.isArray(generated.vocabulary) ? generated.vocabulary : [];

  return items
    .filter(item => item?.word && item?.translation)
    .slice(0, maxWords)
    .map(item => ({
      word: String(item.word).trim(),
      translation: String(item.translation || '').trim(),
      definition: String(item.definition || '').trim(),
      examples: Array.isArray(item.examples) ? item.examples.slice(0, 3) : [],
      pronunciation: '',
      partOfSpeech: item.partOfSpeech || 'other',
      synonyms: [],
      difficulty: item.difficulty || 'intermediate'
    }));
}

/**
 * Chama a API do Azure OpenAI com imagem (GPT-4o Vision)
 * @param {string} prompt - Prompt a enviar
 * @param {string} imageBase64 - Imagem em base64
 * @param {string} mimeType - Tipo MIME da imagem
 * @returns {Promise<Object>} Resposta processada
 */
async function callAzureOpenAIWithImage(prompt, imageBase64, mimeType) {
  const provider = getLlmProvider();

  if (provider === 'foundry') {
    const { endpoint, deployment } = config.foundryOpenAI;

    console.log('📡 Enviando requisição com imagem para Foundry OpenAI...');
    console.log('🔍 Endpoint:', endpoint);
    console.log('🎯 Deployment:', deployment);
    console.log('🔐 Autenticação: API Key (Foundry)');

    try {
      const client = createFoundryClient();

      const response = await createFoundryChatCompletion(client, {
        model: deployment,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      });

      const content = extractContentFromFoundryResponse(response);
      if (!content) {
        const finishReason = response?.choices?.[0]?.finish_reason || 'unknown';
        console.error('⚠️ Foundry sem conteúdo (imagem). finish_reason:', finishReason);
        logFoundryRawResponse('chat.completions:image-empty', response);
        throw new Error('Resposta vazia da API (Foundry)');
      }

      console.log('✅ Resposta com imagem recebida com sucesso (Foundry)');
      try {
        return parseJsonFromLlmContent(content);
      } catch (parseError) {
        console.warn('⚠️ JSON inválido no Foundry (imagem), tentando autocorreção...');
        const repaired = await repairJsonWithFoundry(client, deployment, content);
        if (repaired) {
          console.log('✅ JSON reparado com sucesso (Foundry)');
          return repaired;
        }
        throw parseError;
      }
    } catch (error) {
      console.error('❌ Erro na chamada Foundry com imagem:', error.message);
      throw error;
    }
  }

  const { endpoint, deployment, modelName, apiVersion } = config.azureOpenAI;

  if (!endpoint) {
    throw new Error('Endpoint do Azure OpenAI não encontrado');
  }

  console.log('📡 Enviando requisição com imagem para Azure OpenAI Vision...');

  try {
    const credential = new DefaultAzureCredential();
    const client = new AzureOpenAI({
      endpoint,
      azureADTokenProvider: async () => {
        const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
        return token.token;
      },
      deployment,
      apiVersion
    });

    const response = await client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.7,
      model: modelName
    });

    if (response?.error) {
      throw new Error(`Azure OpenAI error: ${JSON.stringify(response.error)}`);
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia da API');
    }

    console.log('✅ Resposta com imagem recebida com sucesso');

    try {
      return parseJsonFromLlmContent(content);
    } catch (parseError) {
      console.error('⚠️ Erro ao parsear JSON:', parseError.message);
      throw new Error('Resposta da API não está em formato JSON válido');
    }
  } catch (error) {
    console.error('❌ Erro na chamada API com imagem:', error.message);
    throw error;
  }
}

/**
 * Chama a API do Azure OpenAI usando autenticação Azure AD
 * @param {string} prompt - Prompt a enviar
 * @returns {Promise<Object>} Resposta processada
 */
async function callAzureOpenAI(prompt) {
  const provider = getLlmProvider();

  if (provider === 'foundry') {
    const { endpoint, deployment } = config.foundryOpenAI;

    console.log('📡 Enviando requisição para Foundry OpenAI...');
    console.log('🔍 Endpoint:', endpoint);
    console.log('🎯 Deployment:', deployment);
    console.log('🔐 Autenticação: API Key (Foundry)');

    try {
      const client = createFoundryClient();
      const response = await createFoundryChatCompletion(client, {
        model: deployment,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = extractContentFromFoundryResponse(response);
      if (!content) {
        const finishReason = response?.choices?.[0]?.finish_reason || 'unknown';
        console.warn('⚠️ Foundry sem conteúdo via chat.completions. finish_reason:', finishReason);
        logFoundryRawResponse('chat.completions:text-empty', response);
        console.warn('🔁 Tentando fallback via responses.create...');

        const responsesResult = await createFoundryResponse(client, {
          model: deployment,
          input: prompt
        });

        const fallbackContent = extractContentFromResponsesApi(responsesResult);
        if (!fallbackContent) {
          logFoundryRawResponse('responses.create:text-empty', responsesResult);
          throw new Error('Resposta vazia da API (Foundry)');
        }

        console.log('✅ Resposta recebida com sucesso (Foundry responses.create)');
        try {
          return parseJsonFromLlmContent(fallbackContent);
        } catch (parseError) {
          console.warn('⚠️ JSON inválido no fallback Foundry, tentando autocorreção...');
          const repaired = await repairJsonWithFoundry(client, deployment, fallbackContent);
          if (repaired) {
            console.log('✅ JSON reparado com sucesso (Foundry)');
            return repaired;
          }
          throw parseError;
        }
      }

      console.log('✅ Resposta recebida com sucesso (Foundry)');
      try {
        return parseJsonFromLlmContent(content);
      } catch (parseError) {
        console.warn('⚠️ JSON inválido no Foundry, tentando autocorreção...');
        const repaired = await repairJsonWithFoundry(client, deployment, content);
        if (repaired) {
          console.log('✅ JSON reparado com sucesso (Foundry)');
          return repaired;
        }
        throw parseError;
      }
    } catch (error) {
      console.error('❌ Erro na chamada Foundry:', error.message);
      throw error;
    }
  }

  const { endpoint, deployment, modelName, apiVersion } = config.azureOpenAI;

  if (!endpoint) {
    throw new Error('Endpoint do Azure OpenAI não encontrado');
  }

  console.log('📡 Enviando requisição para Azure OpenAI...');
  console.log('🔍 Endpoint:', endpoint);
  console.log('🎯 Deployment:', deployment);
  console.log('🔐 Autenticação: Azure AD (DefaultAzureCredential)');

  try {
    // Criar credential do Azure AD
    const credential = new DefaultAzureCredential();

    // Obter token de acesso
    const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');
    
    console.log('✅ Token Azure AD obtido com sucesso');

    // Criar cliente OpenAI com token
    const client = new AzureOpenAI({
      endpoint,
      azureADTokenProvider: async () => {
        const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
        return token.token;
      },
      deployment,
      apiVersion
    });

    // Chamar API
    const response = await client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.7,
      model: modelName
    });

    if (response?.error) {
      throw new Error(`Azure OpenAI error: ${JSON.stringify(response.error)}`);
    }

    // Extrair conteúdo da resposta
    const content = response.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Resposta vazia da API');
    }

    console.log('✅ Resposta recebida com sucesso');

    // Tentar parsear JSON da resposta
    try {
      // Remover markdown code blocks se existirem
      return parseJsonFromLlmContent(content);
    } catch (parseError) {
      console.error('⚠️ Erro ao parsear JSON:', parseError.message);
      console.log('📄 Conteúdo recebido (primeiros 500 chars):', content.substring(0, 500));
      throw new Error('Resposta da API não está em formato JSON válido');
    }
  } catch (error) {
    console.error('❌ Erro na chamada API:', error.message);
    throw error;
  }
}
