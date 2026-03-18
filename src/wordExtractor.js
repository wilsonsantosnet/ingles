import mammoth from 'mammoth';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { readFileSync } from 'fs';

/**
 * Extrai texto de um arquivo Word (.docx) usando PizZip
 * @param {string} filePath - Caminho do arquivo .docx
 * @returns {Promise<Object>} Objeto com texto e metadados
 */
export async function extractWordContent(filePath) {
  try {
    console.log(`   📏 Lendo arquivo...`);
    const buffer = readFileSync(filePath);
    
    // Tentar primeiro com mammoth
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      if (result.text && result.text.trim().length > 0) {
        console.log(`   ✅ Extraído com mammoth: ${result.text.length} caracteres`);
        return {
          text: result.text,
          messages: result.messages,
          success: true
        };
      }
    } catch (mammothError) {
      console.log(`   ⚠️  Mammoth falhou, tentando PizZip...`);
    }
    
    // Tentar com PizZip
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    // Extrair texto bruto do XML
    const text = doc.getFullText();
    console.log(`   ✅ Extraído com PizZip: ${text.length} caracteres`);
    
    return {
      text: text,
      messages: [],
      success: true
    };
  } catch (error) {
    console.error(`   ❌ Erro ao extrair conteúdo:`, error.message);
    return {
      text: '',
      error: error.message,
      success: false
    };
  }
}

/**
 * Analisa o texto extraído e tenta identificar seções
 * @param {string} text - Texto extraído do Word
 * @param {string} fileName - Nome do arquivo para extrair data
 * @returns {Object} Dados estruturados da aula
 */
export function parseLesson(text, fileName) {
  // Extrair data do nome do arquivo: "Wilson dos Santos - 01October2025.docx"
  const dateMatch = fileName.match(/(\d{2})(\w+)(\d{4})/);
  let lessonDate = new Date().toISOString().split('T')[0];
  
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const monthMap = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    const monthNum = monthMap[month] || '01';
    lessonDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
  }

  // Dividir em parágrafos
  const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
  
  // Estrutura básica
  const lesson = {
    id: `lesson-${lessonDate}`,
    date: lessonDate,
    title: paragraphs[0] || `Aula de ${lessonDate}`,
    rawContent: text,
    paragraphs: paragraphs,
    sections: identifySections(paragraphs)
  };

  return lesson;
}

/**
 * Tenta identificar seções no conteúdo (vocabulário, gramática, etc)
 * @param {string[]} paragraphs - Array de parágrafos
 * @returns {Array} Seções identificadas
 */
function identifySections(paragraphs) {
  const sections = [];
  let currentSection = null;

  const sectionKeywords = {
    vocabulary: ['vocabulary', 'vocabulário', 'words', 'palavras'],
    grammar: ['grammar', 'gramática', 'tense', 'tempo verbal'],
    expressions: ['expressions', 'expressões', 'phrases', 'frases'],
    exercises: ['exercise', 'exercício', 'practice', 'prática'],
    notes: ['notes', 'anotações', 'observations', 'observações']
  };

  paragraphs.forEach((para, index) => {
    const lowerPara = para.toLowerCase();
    let sectionType = 'general';

    // Detectar tipo de seção
    for (const [type, keywords] of Object.entries(sectionKeywords)) {
      if (keywords.some(kw => lowerPara.includes(kw))) {
        sectionType = type;
        break;
      }
    }

    // Se é um cabeçalho de seção
    if (para.length < 50 && sectionType !== 'general') {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        type: sectionType,
        title: para,
        content: []
      };
    } else if (currentSection) {
      currentSection.content.push(para);
    } else {
      // Conteúdo geral antes de qualquer seção
      if (!sections.find(s => s.type === 'general')) {
        sections.push({
          type: 'general',
          title: 'Conteúdo Geral',
          content: []
        });
      }
      sections[sections.length - 1]?.content.push(para);
    }
  });

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}
