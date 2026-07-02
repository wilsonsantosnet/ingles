import fs from 'fs';
import path from 'path';
import OpenAI, { AzureOpenAI } from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { config } from './config.js';

const LESSONS_DIR = path.join(process.cwd(), 'data', 'categories', 'ingles');

function getLlmProvider() {
  return (config.llm?.provider || 'azure_openai').toLowerCase();
}

function createFoundryClient() {
  const { endpoint, apiKey } = config.foundryOpenAI;

  if (!endpoint) {
    throw new Error('FOUNDRY_OPENAI_ENDPOINT não configurado');
  }

  if (!apiKey) {
    throw new Error('FOUNDRY_OPENAI_KEY não configurado');
  }

  return new OpenAI({
    baseURL: endpoint,
    apiKey,
    defaultHeaders: {
      'api-key': apiKey
    }
  });
}

async function callAzureOpenAI(prompt) {
  const provider = getLlmProvider();

  if (provider === 'foundry') {
    const { deployment } = config.foundryOpenAI;
    const client = createFoundryClient();

    const response = await client.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 200,
      model: deployment
    });

    return response.choices?.[0]?.message?.content?.trim();
  }

  const { endpoint, deployment, modelName, apiVersion } = config.azureOpenAI;
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
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.5,
    model: modelName
  });

  return response.choices?.[0]?.message?.content?.trim();
}

async function generateTitle(lesson) {
  const context = [];
  
  if (lesson.enriched?.summary) {
    context.push(`Resumo: ${lesson.enriched.summary}`);
  }
  if (lesson.enriched?.mainTopics?.length) {
    context.push(`Tópicos: ${lesson.enriched.mainTopics.join(', ')}`);
  }
  if (lesson.enriched?.vocabulary?.length) {
    const words = lesson.enriched.vocabulary.slice(0, 10).map(v => v.word).join(', ');
    context.push(`Vocabulário: ${words}`);
  }
  if (lesson.enriched?.grammar?.length) {
    const topics = lesson.enriched.grammar.map(g => g.topic).join(', ');
    context.push(`Gramática: ${topics}`);
  }
  if (lesson.rawContent) {
    context.push(`Conteúdo bruto (primeiros 300 chars): ${lesson.rawContent.substring(0, 300)}`);
  }

  const prompt = `Baseado nos dados abaixo de uma aula de inglês, gere um título CURTO e DESCRITIVO (máximo 80 caracteres) em português que resuma o foco principal da aula. O título deve ser claro, informativo e profissional. Não use aspas na resposta. Responda APENAS com o título, nada mais.

Data da aula: ${lesson.date}

${context.join('\n')}`;

  return await callAzureOpenAI(prompt);
}

async function main() {
  const files = fs.readdirSync(LESSONS_DIR)
    .filter(f => f.startsWith('lesson-') && f.endsWith('.json'))
    .sort();

  console.log(`📚 Encontradas ${files.length} aulas para processar\n`);

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(LESSONS_DIR, file);
    const lesson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Verifica se o título precisa ser melhorado
    const needsUpdate = !lesson.title || 
      lesson.title.toUpperCase().includes('TODAY\'S TAKEAWAYS') ||
      lesson.title.toUpperCase().includes('TAKEAWAYSGRAMMAR') ||
      lesson.title.startsWith('Aula de ') ||
      lesson.title.length > 100;

    if (!needsUpdate) {
      console.log(`⏭️  ${file}: "${lesson.title}" (OK, pulando)`);
      skipped++;
      continue;
    }

    try {
      console.log(`🔄 ${file}: "${lesson.title?.substring(0, 50)}..."`);
      const newTitle = await generateTitle(lesson);
      
      if (newTitle && newTitle.length > 5 && newTitle.length <= 100) {
        lesson.title = newTitle;
        fs.writeFileSync(filePath, JSON.stringify(lesson, null, 2), 'utf-8');
        console.log(`   ✅ Novo título: "${newTitle}"`);
        updated++;
      } else {
        console.log(`   ⚠️  Título gerado inválido: "${newTitle}"`);
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }

    // Delay para não exceder rate limit
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n📊 Resultado: ${updated} atualizados, ${skipped} mantidos, ${files.length - updated - skipped} erros`);
}

main().catch(console.error);
