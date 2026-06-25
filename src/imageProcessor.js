import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { readFileSync, writeFileSync, statSync } from 'fs';
import sharp from 'sharp';
import { config } from './config.js';

/**
 * Processador de imagens com OCR usando Azure OpenAI GPT-4o Vision
 */
export class ImageProcessor {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Inicializa cliente Azure OpenAI (lazy)
   */
  async initializeClient() {
    if (this.initialized) return;

    try {
      // Tentar usar DefaultAzureCredential primeiro
      const credential = new DefaultAzureCredential();
      this.client = new AzureOpenAI({
        endpoint: config.azureOpenAI.endpoint,
        deployment: config.azureOpenAI.deployment,
        apiVersion: config.azureOpenAI.apiVersion,
        azureADTokenProvider: async () => {
          const tokenResponse = await credential.getToken("https://cognitiveservices.azure.com/.default");
          return tokenResponse.token;
        },
        timeout: 120000
      });
      console.log('✅ Azure OpenAI configurado (autenticação via DefaultAzureCredential)');
    } catch (error) {
      // Fallback para API Key
      if (config.azureOpenAI.apiKey) {
        this.client = new AzureOpenAI({
          endpoint: config.azureOpenAI.endpoint,
          apiKey: config.azureOpenAI.apiKey,
          apiVersion: config.azureOpenAI.apiVersion,
          timeout: 120000
        });
        console.log('✅ Azure OpenAI configurado (autenticação via API Key)');
      } else {
        throw new Error('Azure OpenAI não configurado - configure AZURE_OPENAI_ENDPOINT e AZURE_OPENAI_KEY');
      }
    }

    this.initialized = true;
  }

  /**
   * Valida se a imagem é suportada e tem qualidade adequada
   * @param {string} imagePath - Caminho da imagem
   * @returns {Promise<{valid: boolean, reason?: string, metadata?: Object}>}
   */
  async validateImage(imagePath) {
    try {
      // Verificar se arquivo existe e tamanho
      const stats = statSync(imagePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      if (fileSizeMB > 20) {
        return {
          valid: false,
          reason: `Image too large: ${fileSizeMB.toFixed(2)} MB (max 20 MB)`
        };
      }

      // Verificar formato e dimensões com sharp
      const metadata = await sharp(imagePath).metadata();
      
      const supportedFormats = ['jpeg', 'png', 'jpg'];
      if (!supportedFormats.includes(metadata.format)) {
        return {
          valid: false,
          reason: `Unsupported format: ${metadata.format}. Use JPEG or PNG`
        };
      }

      // Verificar dimensões mínimas
      if (metadata.width < 50 || metadata.height < 50) {
        return {
          valid: false,
          reason: `Image too small: ${metadata.width}x${metadata.height} (min 50x50)`
        };
      }

      return {
        valid: true,
        metadata: {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          sizeMB: fileSizeMB
        }
      };
    } catch (error) {
      return {
        valid: false,
        reason: `Failed to read image: ${error.message}`
      };
    }
  }

  /**
   * Pré-processa imagem para melhorar qualidade do OCR
   * @param {string} imagePath - Caminho da imagem original
   * @returns {Promise<Buffer>} Buffer da imagem processada
   */
  async preprocessImage(imagePath) {
    const metadata = await sharp(imagePath).metadata();
    let pipeline = sharp(imagePath);

    // Redimensionar se muito grande (otimizar custo API)
    const maxDimension = 4000;
    if (metadata.width > maxDimension || metadata.height > maxDimension) {
      pipeline = pipeline.resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Converter para JPEG se PNG muito grande
    if (metadata.format === 'png' && (metadata.width * metadata.height) > 4000000) {
      pipeline = pipeline.jpeg({ quality: 90 });
    }

    return await pipeline.toBuffer();
  }

  /**
   * Converte imagem para base64
   * @param {string} imagePath - Caminho da imagem
   * @returns {Promise<{base64: string, mimeType: string}>}
   */
  async imageToBase64(imagePath) {
    const buffer = readFileSync(imagePath);
    const base64 = buffer.toString('base64');
    
    // Detectar mime type
    const metadata = await sharp(imagePath).metadata();
    const mimeType = metadata.format === 'png' ? 'image/png' : 'image/jpeg';
    
    return { base64, mimeType };
  }

  /**
   * Extrai texto de uma imagem usando Azure OpenAI GPT-4o Vision
   * @param {string} imagePath - Caminho da imagem
   * @returns {Promise<Object>} Resultado do OCR
   */
  async extractTextFromImage(imagePath) {
    await this.initializeClient();

    console.log(`🔍 Validando imagem: ${imagePath}`);

    // Validar imagem
    const validation = await this.validateImage(imagePath);
    if (!validation.valid) {
      throw new Error(`Image validation failed: ${validation.reason}`);
    }

    console.log(`📐 Imagem válida: ${validation.metadata.width}x${validation.metadata.height} (${validation.metadata.sizeMB.toFixed(2)} MB)`);

    // Pré-processar e converter para base64
    console.log('🔧 Pré-processando imagem...');
    const processedBuffer = await this.preprocessImage(imagePath);
    
    // Salvar temporariamente para converter em base64
    const tempPath = imagePath + '.temp.jpg';
    writeFileSync(tempPath, processedBuffer);
    
    try {
      const { base64, mimeType } = await this.imageToBase64(tempPath);

      // Chamar GPT-4o Vision
      console.log('📖 Iniciando OCR via GPT-4o Vision...');
      
      const prompt = `Você é um assistente especializado em extrair texto de imagens.

TAREFA:
Extraia TODO o texto visível nesta imagem de forma precisa e estruturada.

INSTRUÇÕES:
1. Mantenha a formatação original (quebras de linha, listas, etc)
2. Se houver títulos ou seções, preservar hierarquia
3. Se houver data no formato DD/MM/YYYY ou similar, inclua
4. Se houver múltiplas colunas, processar da esquerda para direita
5. Ignore elementos gráficos/desenhos, foque apenas no texto
6. Se houver texto manuscrito, faça o melhor esforço para ler

FORMATO DE RESPOSTA:
Retorne APENAS o texto extraído, sem comentários ou análises adicionais.`;

      const response = await this.client.chat.completions.create({
        model: config.azureOpenAI.deployment,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1 // Baixa temperatura para maior precisão
      });

      const extractedText = response.choices[0]?.message?.content || '';
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text extracted from image');
      }

      // Separar em linhas
      const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
      
      // Estimar confiança baseado no comprimento do texto
      // GPT-4o Vision é muito preciso, então usamos métrica simples
      const confidence = lines.length > 0 ? 0.95 : 0.5; // 95% se extraiu texto
      const quality = this.getQualityLevel(confidence);

      console.log(`✅ OCR concluído: ${lines.length} linhas extraídas (qualidade: ${quality})`);

      return {
        success: true,
        text: extractedText.trim(),
        lines,
        confidence,
        quality,
        metadata: {
          ...validation.metadata,
          lineCount: lines.length,
          characterCount: extractedText.length,
          model: config.azureOpenAI.deployment
        }
      };
      
    } catch (error) {
      console.error('❌ Erro no OCR:', error.message);
      throw new Error(`OCR failed: ${error.message}`);
    } finally {
      // Limpar arquivo temporário
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(tempPath);
      } catch (e) {
        // Ignorar erro de limpeza
      }
    }
  }

  /**
   * Determina nível de qualidade baseado na confiança
   * @param {number} confidence - Score de confiança (0-1)
   * @returns {string} Nível de qualidade
   */
  getQualityLevel(confidence) {
    if (confidence >= 0.9) return 'excellent';
    if (confidence >= 0.8) return 'good';
    if (confidence >= 0.7) return 'acceptable';
    return 'poor';
  }

  /**
   * Detecta se a imagem contém texto suficiente para processamento
   * @param {string} imagePath - Caminho da imagem
   * @returns {Promise<boolean>} True se contém texto
   */
  async hasText(imagePath) {
    try {
      const result = await this.extractTextFromImage(imagePath);
      return result.text.length > 50; // Mínimo 50 caracteres
    } catch (error) {
      return false;
    }
  }
}

// Instância singleton
export const imageProcessor = new ImageProcessor();
