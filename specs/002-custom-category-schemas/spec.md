# Feature Specification: Suporte a Múltiplas Categorias com Estruturas Personalizadas

**Feature Branch**: `002-custom-category-schemas`  
**Created**: 2026-03-20  
**Status**: Draft  
**Input**: User description: "Suporte a múltiplas categorias de estudo com estruturas de JSON personalizadas por tipo de categoria"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Processar categoria de tecnologia (Priority: P1)

Professor cria uma nova categoria do tipo "tecnologia" (ex: AZ-104) e adiciona um documento de estudo. O sistema processa o documento e gera conteúdo enriquecido com a estrutura apropriada para tecnologia, incluindo tópicos técnicos, conceitos, comandos, cenários e dicas de exame - sem campos irrelevantes de idioma como gramática, tradução ou pronúncia.

**Why this priority**: É o caso de uso principal que motiva toda a feature. Sem isso, categorias de tecnologia recebem estruturas inadequadas de idioma, confundindo os alunos com campos irrelevantes.

**Independent Test**: Pode ser testado criando uma categoria AZ-104 (type: technology), adicionando um documento sobre Azure, processando-o, e verificando se o JSON gerado contém topics/concepts/commands/scenarios e NÃO contém vocabulary/grammar/expressions.

**Acceptance Scenarios**:

1. **Given** o professor criou uma categoria "AZ-104" com type: "technology", **When** adiciona o documento "Azure Fundamentals.docx" e executa o processamento, **Then** o sistema gera um arquivo lesson-*.json contendo seções "topics", "concepts", "commands", "scenarios" e "examTips"
2. **Given** uma categoria do tipo "technology" foi processada, **When** o professor visualiza o conteúdo enriquecido, **Then** NÃO aparecem campos como "vocabulary", "grammar", "expressions", "pronunciation" ou "culturalNotes"
3. **Given** o aluno acessa uma lição de categoria tecnologia, **When** visualiza o conteúdo, **Then** vê tópicos organizados, conceitos chave, comandos com exemplos, cenários práticos e dicas de exame

---

### User Story 2 - Manter funcionalidade de categorias de idiomas (Priority: P2)

Professor continua usando o sistema para categorias de idiomas (ex: inglês) exatamente como antes. O sistema processa documentos de idiomas mantendo 100% da estrutura e funcionalidade existente com vocabulário, gramática, expressões idiomáticas e notas culturais.

**Why this priority**: Garantir que a nova feature não quebre a funcionalidade existente é crítico para a confiança dos usuários e continuidade do serviço.

**Independent Test**: Pode ser testado criando ou usando uma categoria existente de idioma (type: language), adicionando um documento de aula de inglês, processando-o, e verificando se o JSON mantém todas as seções existentes (vocabulary, grammar, expressions, culturalNotes).

**Acceptance Scenarios**:

1. **Given** o professor usa a categoria "inglês" existente (type: "language"), **When** adiciona um novo documento de aula e processa, **Then** o sistema gera lesson-*.json com as seções "vocabulary", "grammar", "expressions", "exercises" e "culturalNotes"
2. **Given** uma lição de idioma foi processada, **When** o aluno estuda o conteúdo, **Then** todas as funcionalidades existentes funcionam: palavras com tradução, pronúncia, gramática com regras, expressões idiomáticas e notas culturais
3. **Given** existem lições de idioma já processadas anteriormente, **When** o novo sistema é ativado, **Then** todas as lições antigas continuam funcionando sem modificações

---

### User Story 3 - Validar estrutura JSON por tipo de categoria (Priority: P3)

O sistema valida automaticamente que o conteúdo enriquecido gerado corresponde à estrutura esperada para o tipo de categoria. Se detectar inconsistências (ex: categoria de tecnologia com campos de gramática), o sistema reporta o erro para o professor e permite correção.

**Why this priority**: Validação automática previne dados incorretos e garante qualidade do conteúdo sem depender da perfeição do processamento automatizado.

**Independent Test**: Pode ser testado simulando um cenário onde o processamento gera estrutura incorreta e verificando se o sistema detecta e reporta o problema adequadamente.

**Acceptance Scenarios**:

1. **Given** o sistema processou uma categoria de tecnologia, **When** o conteúdo gerado contém campos inesperados (ex: "grammar" ou "vocabulary"), **Then** o sistema registra um aviso indicando incompatibilidade de estrutura
2. **Given** o sistema detectou estrutura incorreta, **When** o professor visualiza os resultados do processamento, **Then** recebe notificação clara sobre a inconsistência e quais campos estão fora do padrão
3. **Given** uma validação falhou, **When** o professor solicita reprocessamento, **Then** o sistema tenta novamente gerar a estrutura correta para aquele tipo de categoria

---

### User Story 4 - Adicionar novo tipo de categoria (Priority: P4)

Administrador do sistema adiciona um novo tipo de categoria (ex: type: "exam-prep" para preparação para concursos) definindo sua estrutura de dados em um arquivo de configuração, sem precisar modificar o código principal do sistema.

**Why this priority**: Extensibilidade garante que o sistema pode evoluir para suportar novos domínios de estudo sem refatoração completa, mas não é crítica para o lançamento inicial.

**Independent Test**: Pode ser testado criando uma configuração para um novo tipo "exam-prep", definindo sua estrutura (ex: laws, jurisprudence, cases), e verificando se o sistema processa categorias desse tipo usando a estrutura configurada.

**Acceptance Scenarios**:

1. **Given** o administrador quer suportar preparação para concursos, **When** adiciona configuração para type: "exam-prep" com esquema personalizado, **Then** o sistema reconhece o novo tipo ao processar categorias
2. **Given** um novo tipo foi configurado, **When** o professor cria categoria usando esse tipo, **Then** o processamento usa automaticamente a estrutura definida para aquele tipo
3. **Given** sistema suporta múltiplos tipos configurados, **When** professores usam categorias de tipos diferentes, **Then** cada categoria usa sua estrutura apropriada sem conflitos

---

### Edge Cases

- **Categoria sem tipo definido**: Se categories.json não especifica o campo "type" para uma categoria, o sistema usa "language" como padrão (comportamento backward-compatible)
- **Tipo de categoria não reconhecido**: Se category.type contém valor desconhecido (ex: "mathematics"), o sistema reporta erro claro indicando tipos válidos disponíveis
- **Estrutura incorreta retornada**: Se o enriquecimento via LLM retorna estrutura que não corresponde ao tipo da categoria, o sistema:
  - Valida os campos obrigatórios esperados
  - Registra discrepância em log de processamento
  - Opcionalmente tenta reprocessar uma vez
  - Se persistir, salva conteúdo parcial com flag de "requires-review"
- **Migração de lições existentes**: Lições de AZ-104 já processadas com estrutura de idioma permanecem acessíveis mas são marcadas para reprocessamento opcional
- **Categoria híbrida**: Tentativa de criar categoria que mistura tipos (ex: "language" + "technology") retorna erro indicando que cada categoria deve ter um único tipo bem definido

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema MUST identificar o tipo de cada categoria através do campo "type" no arquivo de configuração de categorias
- **FR-002**: Sistema MUST suportar no mínimo dois tipos distintos de categorias: "language" para idiomas e "technology" para tecnologia/certificações
- **FR-003**: Sistema MUST usar estruturas de dados diferentes para enriquecimento baseado no tipo da categoria
- **FR-004**: Para categorias tipo "language", sistema MUST gerar estrutura com: vocabulary (palavras, traduções, pronúncia), grammar (regras gramaticais), expressions (expressões idiomáticas), exercises (exercícios), culturalNotes (notas culturais)
- **FR-005**: Para categorias tipo "technology", sistema MUST gerar estrutura com: topics (tópicos técnicos), concepts (conceitos chave), commands (comandos/código), scenarios (cenários de uso), exercises (exercícios), examTips (dicas para exames)
- **FR-006**: Sistema MUST validar que a estrutura do conteúdo enriquecido corresponde ao tipo da categoria
- **FR-007**: Sistema MUST reportar ao professor quando detectar incompatibilidade entre tipo de categoria e estrutura gerada
- **FR-008**: Sistema MUST usar "language" como tipo padrão quando category.type não estiver especificado
- **FR-009**: Sistema MUST reportar erro claro quando encontrar tipo de categoria não reconhecido
- **FR-010**: Sistema MUST permitir que professores vejam qual tipo está configurado para cada categoria
- **FR-011**: Alunos MUST visualizar conteúdo formatado apropriadamente baseado no tipo da categoria (campos de idioma para language, campos técnicos para technology)
- **FR-012**: Sistema MUST manter compatibilidade completa com lições de idioma existentes após implementação

### Key Entities

- **Category**: Representa uma área de estudo (ex: inglês, AZ-104). Possui nome, descrição, tipo (language/technology), e coleção de lições
- **Category Type**: Define o tipo de categoria (language, technology, exam-prep, etc.). Especifica qual estrutura de dados deve ser usada para enriquecimento do conteúdo
- **Lesson Content Schema**: Define a estrutura esperada do JSON enriquecido para cada tipo de categoria. Para "language": vocabulary, grammar, expressions, exercises, culturalNotes. Para "technology": topics, concepts, commands, scenarios, exercises, examTips
- **Enriched Content**: Dados processados e enriquecidos de uma lição, estruturados conforme o schema do tipo de categoria
- **Validation Result**: Resultado da verificação se o conteúdo enriquecido corresponde à estrutura esperada para o tipo da categoria. Inclui status (válido/inválido) e lista de campos faltantes ou inesperados

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das lições de categorias tipo "language" mantêm todas as funcionalidades existentes após implementação (vocabulário com tradução, gramática, expressões idiomáticas)
- **SC-002**: 0% das lições de categorias tipo "technology" contêm campos irrelevantes de idioma (grammar, translation, pronunciation)
- **SC-003**: 100% das lições processadas têm estrutura validada como compatível com o tipo de sua categoria
- **SC-004**: Sistema detecta e reporta 100% dos casos onde estrutura gerada não corresponde ao tipo de categoria
- **SC-005**: Professores conseguem processar documentos de categoria tecnologia e ver resultado apropriado em menos de 5 minutos (mesmo tempo do fluxo atual)
- **SC-006**: Alunos conseguem identificar facilmente se estão estudando conteúdo de idioma ou tecnologia pela organização e nomenclatura das seções
- **SC-007**: 90% dos professores consideram a estrutura de tecnologia mais apropriada que a anterior para categorias técnicas (pesquisa de satisfação)
- **SC-008**: Tempo de processamento de documentos permanece similar ao atual (variação máxima de 20%)

## Assumptions

- LLM (serviço de enriquecimento) consegue gerar estruturas JSON diferentes quando instruído adequadamente através de prompts específicos
- Categorias de idiomas continuam sendo a maioria do uso do sistema (backward compatibility é prioridade)
- Estrutura de "technology" proposta é suficiente para categorias técnicas/certificações inicialmente (pode evoluir baseado em feedback)
- Categories.json é o local apropriado para definir o tipo de cada categoria
- Não há necessidade de conversão automática de lições antigas de AZ-104 - professores podem reprocessar manualmente quando desejarem
- Frontend pode adaptar visualização baseado na presença/ausência de campos específicos sem modificações estruturais grandes
- Validação básica de estrutura (presença de campos esperados) é suficiente inicialmente - validação profunda de conteúdo não é necessária
