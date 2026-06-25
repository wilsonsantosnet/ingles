# Changelog - Lesson Creation Process Specification

## Version 2.0 - March 20, 2026

### 🎯 Principais Adições

#### 1. **Suporte a Imagens como Fonte de Conteúdo**
- **User Story 6**: Create Lesson from Image (Priority P2)
- Professores podem fotografar quadros brancos, anotações manuscritas ou materiais impressos
- Sistema extrai texto usando OCR/Azure Computer Vision
- Validação de qualidade da imagem antes do processamento
- Marca fonte como "📸 Image" para rastreabilidade

#### 2. **Enriquecimento Especializado por Tipo de Categoria**
- **User Story 7**: Specialized Enrichment by Category Type (Priority P1)
- **Para categorias de idiomas** (type: "language"):
  - Vocabulário (palavra, tradução, definição, exemplos)
  - Gramática (regras, explicações, estruturas)
  - Expressões idiomáticas e collocations
  - Exercícios conversacionais
  
- **Para categorias de tecnologia** (type: "technology"):
  - Tópicos técnicos e conceitos-chave
  - Comandos (Azure CLI, PowerShell, bash)
  - Snippets de código com sintaxe
  - Cenários de troubleshooting
  - Questões estilo certificação

### 📋 Novos Functional Requirements

| ID | Descrição |
|----|-----------|
| **FR-021** | Aceitar arquivos de imagem (JPEG, PNG) como fonte |
| **FR-022** | Extrair texto de imagens usando OCR/Azure Vision |
| **FR-023** | Aplicar estratégias de enriquecimento especializadas por tipo de categoria |
| **FR-024** | Validar qualidade da imagem antes do OCR |
| **FR-025** | Rastrear tipo de fonte (docx, manual, image) em metadata |
| **FR-026** | Usar prompts LLM específicos por categoria |
| **FR-027** | Lidar com conteúdo misto em imagens (texto + diagramas) |

### ✅ Novos Success Criteria

| ID | Métrica |
|----|---------|
| **SC-013** | 95%+ de acurácia na extração de texto de imagens claras |
| **SC-014** | 0% de campos de tecnologia em lições de idioma (separação total) |
| **SC-015** | 0% de campos de idioma em lições de tecnologia (separação total) |
| **SC-016** | OCR completo em <2 minutos para imagens típicas |
| **SC-017** | 100% de acerto na detecção de tipo de categoria |
| **SC-018** | 90%+ de detecção de imagens ilegíveis antes do OCR |
| **SC-019** | 100% de questões relevantes para certificação em lições de tecnologia |
| **SC-020** | 100% de exercícios conversacionais em lições de idioma |

### 🔑 Novas Entidades

- **Image Source**: Metadados de imagens (dimensões, formato, score OCR)
- **Technical Topic**: Conceitos e features técnicas (exclusivo para tecnologia)
- **Command/Code Snippet**: Comandos CLI e código (exclusivo para tecnologia)
- **Concept**: Princípios técnicos fundamentais (exclusivo para tecnologia)

### 📝 Edge Cases Adicionados

1. **Empty Image**: Imagem sem texto detectável
2. **Mixed Image**: Texto + diagramas/gráficos
3. **Image File Size**: Imagens muito grandes (redimensionamento)
4. **Unsupported Image Format**: Formatos não suportados (TIFF, BMP)
5. **Category Type Mismatch**: Conteúdo de idioma em categoria de tecnologia (ou vice-versa)

### 🎓 Assumptions Atualizados

- Azure Computer Vision configurado e acessível
- Imagens têm texto legível (não severamente borradas)
- Tipo de categoria configurado corretamente antes do processamento
- Diferentes tipos de categoria requerem estruturas de enriquecimento fundamentalmente diferentes

---

## Impacto na Implementação

### Backend
- **Novo módulo**: `imageProcessor.js` para OCR
- **Atualização**: `llmEnricher.js` já tem dispatch por tipo (implementado em Spec 002)
- **Configuração**: Azure Computer Vision endpoint e credenciais

### Frontend
- **Ícone de fonte**: Adicionar "📸 Image" além de "📄 Word" e "✍️ Manual"
- **Upload de imagem**: Interface para upload de JPEG/PNG no CRUD
- **Preview**: Mostrar preview da imagem antes do processamento

### Dependências Externas
- **Azure Computer Vision API**: OCR e análise de imagem
- **@azure/cognitiveservices-computervision**: SDK Node.js

---

## Próximos Passos

1. ✅ **Especificação Atualizada** (concluído)
2. ⏳ **Plano de Implementação** (criar tasks detalhadas)
3. ⏳ **Implementação Backend** (imageProcessor + integração)
4. ⏳ **Implementação Frontend** (upload de imagem)
5. ⏳ **Testes** (validação com imagens reais)
6. ⏳ **Documentação** (guia para professores)

---

**Status**: Especificação revisada e aprovada ✅  
**Próxima Ação**: Gerar plano de implementação detalhado
