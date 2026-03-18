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
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://openaiws01.openai.azure.com/",
    apiKey: process.env.AZURE_OPENAI_KEY || "",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    modelName: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-04-01-preview"
  },
  port: process.env.PORT || 3000,
  paths: {
    docs: join(__dirname, '..', 'docs'),
    processed: join(__dirname, '..', 'data', 'processed'),
    userData: join(__dirname, '..', 'data', 'user-data.json')
  }
};
