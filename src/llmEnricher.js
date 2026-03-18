import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { config } from './config.js';

/**
 * Enriquece o conteúdo da aula usando Azure OpenAI
 * @param {Object} lesson - Dados da aula
 * @returns {Promise<Object>} Conteúdo enriquecido
 */
export async function enrichWithLLM(lesson) {
  console.log(`\n🤖 Enriquecendo aula: ${lesson.title}...`);
  
  const prompt = createEnrichmentPrompt(lesson);
  
  try {
    const enrichedContent = await callAzureOpenAI(prompt);
    
    return {
      ...lesson,
      enriched: enrichedContent,
      enrichedAt: new Date().toISOString(),
      status: 'enriched'
    };
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
 * Cria o prompt para enriquecimento
 * @param {Object} lesson - Dados da aula
 * @returns {string} Prompt formatado
 */
function createEnrichmentPrompt(lesson) {
  return `Você é um assistente especializado em ensino de inglês. Analise o conteúdo da aula abaixo e enriqueça-o com informações úteis para estudo.

CONTEÚDO DA AULA:
${lesson.rawContent}

TAREFA:
Retorne um JSON estruturado com o seguinte formato:

{
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
  ]
}

INSTRUÇÕES CRÍTICAS:
1. EXTRAIA TODO O VOCABULÁRIO presente no documento:
   - Palavras isoladas listadas na seção VOCABULARY
   - Expressões idiomáticas (como "do the dishes", "in a row", etc)
   - Verbos irregulares com suas formas (drink-drank, take-took, etc)
   - Qualquer termo em inglês com tradução fornecida

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

IMPORTANTE:
- Retorne APENAS o JSON, sem markdown ou texto adicional
- Seja preciso e educativo
- Use o conteúdo original como base principal
- Priorize informações práticas para memorização
`;
}

/**
 * Chama a API do Azure OpenAI usando autenticação Azure AD
 * @param {string} prompt - Prompt a enviar
 * @returns {Promise<Object>} Resposta processada
 */
async function callAzureOpenAI(prompt) {
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
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanedContent);
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
