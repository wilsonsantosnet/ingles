import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env manualmente (sem dependência externa)
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        process.env[key.trim()] = value.trim();
      }
    });
  } catch (error) {
    console.warn('Arquivo .env não encontrado, usando variáveis de ambiente do sistema');
  }
}

loadEnv();

export const config = {
  llm: {
    provider: process.env.LLM_PROVIDER || 'azure_openai' // azure_openai | foundry
  },
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://openaiws01.openai.azure.com/",
    apiKey: process.env.AZURE_OPENAI_KEY || "",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    modelName: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-04-01-preview"
  },
  foundryOpenAI: {
    endpoint: process.env.FOUNDRY_OPENAI_ENDPOINT || "",
    apiKey: process.env.FOUNDRY_OPENAI_KEY || "",
    deployment: process.env.FOUNDRY_OPENAI_DEPLOYMENT || "gpt-5-mini",
    apiVersion: process.env.FOUNDRY_OPENAI_API_VERSION || "v1",
    maxCompletionTokens: parseInt(process.env.FOUNDRY_MAX_COMPLETION_TOKENS || '16384', 10),
    reasoningEffort: process.env.FOUNDRY_REASONING_EFFORT || 'medium'
  },
  port: process.env.PORT || 3000,
  paths: {
    root: join(__dirname, '..'),
    docs: join(__dirname, '..', 'docs'),
    data: join(__dirname, '..', 'data'),
    categories: join(__dirname, '..', 'data', 'categories'),
    categoriesJson: join(__dirname, '..', 'data', 'categories.json'),
    // Paths legados (para compatibilidade)
    processed: join(__dirname, '..', 'data', 'categories', 'ingles'),
    userData: join(__dirname, '..', 'data', 'user-data.json')
  },
  
  /**
   * Retorna os paths de uma categoria específica
   * @param {string} categoryId - ID da categoria
   */
  getCategoryPaths(categoryId) {
    const base = join(__dirname, '..', 'data', 'categories', categoryId);
    return {
      docs: join(__dirname, '..', 'docs', categoryId),
      processed: base,
      index: join(base, 'index.json')
    };
  }
};
