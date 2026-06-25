# Comandos do Projeto

Este guia resume os comandos mais usados no projeto `ingles` para desenvolvimento local, processamento de documentos e publicação no Azure.

## 1. Requisitos

```powershell
# Node.js e dependências
npm install

# Login Azure (necessário para Azure OpenAI e deploy)
az login
azd auth login
```

## 2. Rodar a aplicacao localmente

```powershell
# Producao local
npm start

# Desenvolvimento com watch
npm run dev
```

A aplicacao sobe em `http://localhost:3000`.

## 3. Categorias

```powershell
# Listar categorias
npm run categories:list

# Criar categoria
npm run categories:create -- --id az104 --name "Azure AZ-104" --description "Microsoft Azure Administrator" --icon "☁️"
```

## 4. Processar documentos

Coloque os arquivos em `docs/<categoria>/`.

```powershell
# Processamento incremental (somente novos)
npm run process -- --category=ingles

# Reprocessar tudo da categoria
npm run process -- --category=ingles --force

# Atalho legado (usa categoria padrao)
npm run process
npm run process:force
```

## 5. Reprocessar um arquivo especifico

O projeto nao possui script npm pronto para arquivo unico.

Opcao recomendada:
1. usar o fluxo de reprocessamento pontual via script auxiliar (como fizemos em suporte)
2. ou mover temporariamente apenas o arquivo alvo para a pasta da categoria e rodar `--force` em ambiente controlado

Se for necessario fazer isso com frequencia, vale criar um script oficial `npm run process:file`.

## 6. Gerar/limpar titulos

```powershell
# Limpar titulos ruins/longos
npm run clean:titles
```

## 7. Deploy no Azure

```powershell
# Ver ambiente atual
azd env list
azd env get-values

# Configurar segredo (se necessario)
azd env set AZURE_OPENAI_KEY "<sua-chave>"

# Provisionar infra + publicar app (primeira vez)
azd up

# Publicar somente codigo (infra ja existe)
azd deploy --no-prompt
```

## 8. Verificacao pos-deploy

```powershell
# Endpoint principal
Invoke-WebRequest https://app-fa2ulr5w2fiwk.azurewebsites.net/ -UseBasicParsing | Select-Object StatusCode

# Endpoint de aulas
Invoke-WebRequest https://app-fa2ulr5w2fiwk.azurewebsites.net/api/categories/ingles/lessons -UseBasicParsing | Select-Object -ExpandProperty Content
```

## 9. Solucao rapida para indice de aulas vazio

Se as aulas sumirem na UI, reconstrua o indice com base nos arquivos `lesson-*.json`:

```powershell
node -e "const fs=require('fs'); const path=require('path'); const base='data/categories/ingles'; const files=fs.readdirSync(base).filter(n=>/^lesson-.*\\.json$/.test(n)).sort(); const lessons=files.map(n=>{const j=JSON.parse(fs.readFileSync(path.join(base,n),'utf8')); return {id:j.id,date:j.date,title:j.title,file:j.source||'docx',status:j.status||'enriched'};}); const idx={categoryId:'ingles',processedAt:new Date().toISOString(),totalLessons:lessons.length,lessons}; fs.writeFileSync(path.join(base,'index.json'), JSON.stringify(idx,null,2),'utf8'); console.log('rebuilt lessons=', lessons.length);"
```

Depois, publique novamente:

```powershell
azd deploy --no-prompt
```
