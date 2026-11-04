# Contexto para continuar: Painel Escola das Artes 2027 no Google Cloud

> Documento de passagem de bastão. Leia inteiro antes de sugerir qualquer comando.
> Atualizado em 04/11/2026.

## 1. Quem é o usuário e o que ele quer

- **Usuário:** Celso (conta Google `celsolauro@gmail.com`), da Secretaria de Cultura de Jaguariúna/SP. Usa principalmente o iPhone e escreve em português do Brasil.
- **Objetivo:** publicar no Google Cloud o painel "Escola das Artes · Gestão 2027", com:
  - o visual e as funcionalidades atuais preservados;
  - **acesso restrito a uma única conta Google**: `celsolauro@gmail.com`;
  - abertura no **Safari do iPhone**, com atalho na Tela de Início.
- **Projeto Google Cloud:** `surrebiflu-1`. Um ID anterior, `celsolauro-org`, estava errado e já foi corrigido.
- **Repositório GitHub:** `celsolauro/symmetrical-journey`, branch **`escola-das-artes-cloudrun`**. Não há pull request aberto, e o `main` não foi alterado.

## 2. Regras de segurança impostas pelo usuário (obrigatórias)

1. Não publicar o site sem autenticação. Nada de `--allow-unauthenticated`, `allUsers` ou `allAuthenticatedUsers`.
2. Não tornar a planilha pública. Não expor no navegador o ID da planilha, tokens, chaves ou credenciais.
3. Ler a planilha **pelo servidor**, com o mínimo de permissões, a partir de uma planilha de produção **privada**.
4. **Não usar dados reais** sem confirmação explícita do usuário. Por enquanto, só dados fictícios.
5. **Nunca pedir nem imprimir** senha, códigos de autenticação, tokens ou chaves privadas. Usar o login oficial do `gcloud`.
6. Não conceder papéis amplos (Owner ou Editor) sem necessidade.
7. Se faltar permissão, parar e informar quais são os papéis IAM mínimos, sem contornar.
8. Preservar os arquivos originais. A configuração de deploy fica separada.
9. Restringir o IAP **exclusivamente** a `celsolauro@gmail.com`. Usar uma conta de serviço dedicada que só lê a planilha necessária.
10. Testar que uma janela sem login é bloqueada e que a conta autorizada consegue abrir.
11. **Não alterar nem excluir a planilha de demonstração.**
12. Não dar o deploy como concluído sem comprovar que o login e a leitura privada funcionam.
13. Se alguma etapa exigir autorização manual do usuário, parar e dizer qual é.

**Decisão mais recente do usuário:** ele mesmo vai publicar pelo **Cloud Shell**, como fez num projeto anterior, o sistema de agendamento da Cultura. O assistente anterior **não tem credenciais** do Google Cloud, e um login pendente foi cancelado. Nenhum recurso foi criado no Google Cloud até agora.

## 3. Origem do projeto

O projeto veio de um ZIP gerado no Manus. Era um site estático, `public/index.html`, que lia a aba `Professores` de uma planilha Google Sheets de **demonstração** por JSONP (`gviz`). Para isso funcionar, essa planilha precisa ser pública por link.

A auditoria original (`SECURITY_AUDIT.md`) diz:
> "Aprovado somente para demonstração com dados fictícios públicos. Reprovado para dados reais privados."

A planilha de demonstração tem 12 professores fictícios e as abas `Professores`, `Lancamentos`, `Turmas`, `Parametros` e `Instrucoes`. O ID dela aparece no código original. Ela **deve continuar como está**.

### Estrutura da aba `Professores` (colunas)

| Coluna | Conteúdo |
|---|---|
| A | código |
| B | professor |
| C | eixo |
| D | contrato |
| E | horas contratadas |
| F | horas executadas |
| G | % de consumo |
| H | status |
| I | saldo |
| J | última competência |
| K a P | histórico mensal de jan a jun/2027 |
| Q | encaminhamento sugerido |
| R | cor (hex) |

Limites de consumo: alerta a partir de 60%, crítico a partir de 80%, excedido a partir de 100%.

## 4. O que já foi feito (no branch `escola-das-artes-cloudrun`)

```
escola-das-artes/
├── original/                  # ZIP do Manus, sem alterações (hashes conferidos)
└── cloudrun/                  # configuração separada de deploy
    ├── server.js              # Node 22, sem dependências npm
    ├── package.json           # "npm test" roda os testes
    ├── Dockerfile             # node:22-alpine, usuário não-root
    ├── .gcloudignore / .dockerignore
    ├── public/
    │   ├── index.html         # original com 3 mudanças mínimas (ver abaixo)
    │   ├── app.js             # script do original; só o carregamento de dados mudou
    │   └── assets/
    │       ├── logo-escola-das-artes.png   # novo símbolo enviado pelo usuário, PNG TRANSPARENTE
    │       └── apple-touch-icon.png        # 180×180 com fundo branco (iOS pinta transparência de preto)
    ├── test/server.test.js    # 6 testes (Sheets e IAP simulados, JWT ES256 reais)
    ├── deploy/deploy.sh       # verificar | preparar | publicar | testar | auditar | logs | bloquear
    └── LEIA-ME-DEPLOY.md      # arquitetura, custos, papéis IAM, passo a passo, iPhone
```

### Arquitetura

```
Safari/iPhone ─► Cloud Run (*.run.app) com IAP ativado direto no serviço (sem balanceador)
                   │ IAP: login Google; só celsolauro@gmail.com tem roles/iap.httpsResourceAccessor
                   │ Cloud Run: --no-allow-unauthenticated; só o agente do IAP tem roles/run.invoker
                   ▼
                 server.js
                   │ 1) verifica de novo o header x-goog-iap-jwt-assertion (ES256, chaves do gstatic,
                   │    iss=https://cloud.google.com/iap, aud=/projects/NUM/locations/REGIAO/services/escola-das-artes,
                   │    e-mail em ALLOWED_EMAILS); sem isso, responde 403 em TODAS as rotas
                   │ 2) token do metadata server com escopo spreadsheets.readonly
                   ▼
                 Sheets API v4 values.get("Professores!A1:R501", UNFORMATTED_VALUE)
                   ▼
                 planilha PRIVADA (cópia), compartilhada só como "Leitor" com a conta de serviço
```

- **Conta de serviço do app:** `escola-artes-leitor@surrebiflu-1.iam.gserviceaccount.com`. Tem **zero papéis** no projeto. O único acesso dela é "Leitor" na planilha, concedido pelo Drive.
- **Variáveis de ambiente no Cloud Run:** `SHEET_ID`, `ALLOWED_EMAILS=celsolauro@gmail.com` e `IAP_AUDIENCE`. O ID da planilha **não** está no repositório e é passado só no deploy.
- **API `/api/professores`:** devolve só 9 campos validados (`code`, `name`, `axis`, `contract`, `contracted`, `executed`, `monthly[6]`, `action`, `color`).
  - Ignora linhas de título e cabeçalho, exigindo código e horas contratadas maiores que 0.
  - Limita a 500 linhas.
  - Guarda os dados em cache por 20 s; o botão de atualizar força a leitura com `?refresh=1`.
- **Cabeçalhos de segurança:**
  - CSP: `script-src 'self'`, sem script inline. `style-src` tem `'unsafe-inline'` porque o painel usa atributos `style` calculados, e permite Google Fonts.
  - Também: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS, `Permissions-Policy`, `Referrer-Policy`, COOP/CORP e `X-Robots-Tag noindex`.
- **Arquivos estáticos:** servidos de uma lista fechada; qualquer outro caminho dá 404. Métodos que não sejam GET ou HEAD dão 405.
- **Proteção extra:** no Cloud Run, quando `K_SERVICE` existe, o servidor **se recusa a iniciar** se alguém tentar `IAP_CHECK=off`.

### Mudanças no frontend em relação ao original

1. O script inline foi movido para `/app.js`. Saíram o `SHEET_ID` e o JSONP `gviz`. O carregamento agora usa `fetch('/api/professores', {credentials:'same-origin', redirect:'manual'})`, com revalidação dos campos no navegador.
2. Se a sessão do IAP expirar (redirect, 401 ou 403), aparece "Sessão expirada · recarregue a página".
3. O logo agora é `/assets/logo-escola-das-artes.png`, o novo símbolo de quatro formas (azul, amarelo, vermelho, roxo) com fundo transparente para o modo escuro. Também há `apple-touch-icon` e `apple-mobile-web-app-title`.

Todo o resto ficou igual: KPIs, barras com marcas de 60% e 80%, busca, filtros, ordenação, modal/folha inferior, tema claro e escuro, e o selo "Demonstração · dados fictícios".

### Verificações já feitas (todas locais)

- **Testes:** `npm test` passa os 6.
  - Sem header, com JWT inválido, de outro e-mail, de outra audiência, expirado, de outro emissor ou com outra chave: 403.
  - Com usuário autorizado: página com os cabeçalhos certos e nenhum ID de planilha.
  - API: devolve só os campos validados.
  - Travessia de caminho e POST: recusados.
  - IAP não pode ser desligado no Cloud Run.
- **Navegador:** Playwright com tela de iPhone 15 e dados fictícios. Lista, KPIs, modal, filtros e atualização funcionaram, sem erros de console nem violações de CSP. O logo foi conferido nos modos claro e escuro.
- **Varredura de segredos:** nenhuma chave ou token no código.

### O que NÃO foi verificado

- O build Docker: não havia daemon disponível. O Cloud Build é que vai construir.
- A planilha de demonstração real: `docs.google.com` estava bloqueado na rede da sessão. A leitura usa a API `values.get` e filtra linhas sem código ou sem horas contratadas, então deve funcionar com cabeçalho em qualquer linha. Ainda assim, confirme no primeiro deploy.
- Qualquer coisa no Google Cloud: nada foi criado.

## 5. Próximos passos (o usuário executa; o assistente orienta)

### Manual A: criar a planilha privada (Google Drive, conta do usuário)
1. Abrir a planilha de demonstração e usar **Arquivo → Fazer uma cópia**. **Não mexer na original.**
2. Na cópia, em Compartilhar, deixar *Acesso geral* como **Restrito**.
3. Anotar o ID da cópia, o trecho entre `/d/` e `/edit`. Os dados continuam fictícios.

### Cloud Shell (https://shell.cloud.google.com com celsolauro@gmail.com)
```bash
git clone -b escola-das-artes-cloudrun https://github.com/celsolauro/symmetrical-journey.git
cd symmetrical-journey/escola-das-artes/cloudrun
gcloud config set project surrebiflu-1
./deploy/deploy.sh verificar      # SOMENTE LEITURA: conta, projeto, faturamento, organização, papéis, APIs
./deploy/deploy.sh preparar       # pede "SIM"; ativa APIs; cria a conta de serviço sem papéis
```
Se o repositório for privado e o `git clone` pedir login, o usuário pode baixar o ZIP do branch no site do GitHub e usar ⋮ → Upload no Cloud Shell. Se já tiver clonado antes, basta `git pull`.

- **APIs ativadas pelo `preparar`:** `run`, `cloudbuild`, `artifactregistry`, `iap` e `sheets`.
- **Agente do IAP:** o script também roda `gcloud beta services identity create --service=iap.googleapis.com`.

### Manual B: compartilhar a cópia com a conta de serviço
Compartilhar com `escola-artes-leitor@surrebiflu-1.iam.gserviceaccount.com` como **Leitor**, com "Notificar" desmarcado.

### Publicar
```bash
./deploy/deploy.sh publicar ID_DA_COPIA_PRIVADA
```
O script recusa o ID da planilha de demonstração e pede "SIM". Em seguida:
1. Roda `gcloud run deploy escola-das-artes --source . --region=us-central1 --service-account=… --no-allow-unauthenticated --iap --ingress=all --min-instances=0 --max-instances=2 --cpu=1 --memory=256Mi --concurrency=40 --timeout=30 --set-env-vars=SHEET_ID=…,ALLOWED_EMAILS=…,IAP_AUDIENCE=/projects/NUM/locations/us-central1/services/escola-das-artes`.
2. Concede `roles/run.invoker` no serviço a `service-NUM@gcp-sa-iap.iam.gserviceaccount.com`.
3. Roda `gcloud iap web add-iam-policy-binding --resource-type=cloud-run --service=escola-das-artes --region=us-central1 --member=user:celsolauro@gmail.com --role=roles/iap.httpsResourceAccessor`.
4. Audita as políticas. Se houver `allUsers`, `allAuthenticatedUsers` ou outros membros no IAP, **bloqueia** o serviço com `--ingress=internal` e para.
5. Testa automaticamente:
   - Acesso anônimo a `/`, `/api/professores` e `/app.js`: nenhuma rota pode responder 2xx; se alguma responder, bloqueia.
   - Leitura anônima da planilha via `gviz`: não pode responder 200.
6. Mostra a URL.

### Teste final (manual)
- Abrir a URL numa janela anônima. Ao entrar com `celsolauro@gmail.com`, o painel deve carregar com "Fonte: Google Sheets · atualizado às …".
- Rodar `./deploy/deploy.sh logs`. O log deve mostrar 200 em `/api/professores` e nenhum erro.
- Só então declarar a publicação concluída.

### iPhone
1. Abrir a URL no **Safari**, fazer login e tocar em **Compartilhar → Adicionar à Tela de Início**.
2. Se o login entrar em ciclo ao abrir pelo ícone, remover o ícone e adicionar de novo com **"Abrir como App Web" desligado**.

## 6. Riscos e problemas conhecidos

- **Login com @gmail.com recusado pelo IAP:** pode acontecer se o projeto pertencer a uma organização (Workspace ou Cloud Identity). O cliente OAuth gerenciado pelo Google pode aceitar só usuários da organização. Nesse caso, o usuário cria um **cliente OAuth personalizado** pelo Console:
  1. Google Auth Platform: público **Externo**, com `celsolauro@gmail.com` como usuário de teste.
  2. Clientes: criar um "Aplicativo da Web".
  3. Adicionar o redirect `https://iap.googleapis.com/v1/oauth/clientIds/CLIENT_ID:handleRedirect`.
  4. Em Segurança → Identity-Aware Proxy → serviço → Configurações, informar o client ID e a chave secreta.

  A chave secreta **não pode** passar pelo chat.
- **Restrição de domínio (`iam.allowedPolicyMemberDomains`):** se a organização tiver essa política, ela bloqueia `user:celsolauro@gmail.com`. O `verificar` mostra isso.
- **Build com `PERMISSION_DENIED`:** se o erro envolver `NUM-compute@developer.gserviceaccount.com`, conceder a essa conta `roles/run.builder`, o papel mínimo para deploy a partir do código.
- **Faturamento:** o projeto precisa ter uma conta de faturamento vinculada.
- **Ambiguidade herdada do original:** valores mensais menores ou iguais a 1 são tratados como fração. Assim, 108% gravado como `1,08` aparece como 1,1%. A regra original foi mantida de propósito.
- **Erro de flag:** `gcloud auth login --update-adc=false` não existe. Se precisar logar, use só `gcloud auth login`. No Cloud Shell não é necessário.

## 7. Papéis IAM mínimos (se o usuário NÃO for Proprietário do projeto)

- `roles/serviceusage.serviceUsageAdmin`: ativar APIs, uma única vez.
- `roles/iam.serviceAccountCreator`: criar a conta de serviço, uma única vez.
- `roles/iam.serviceAccountUser`: **somente na conta de serviço** `escola-artes-leitor@…`.
- `roles/run.sourceDeveloper` e `roles/run.admin`.
- `roles/iap.admin`.
- `roles/logging.viewer`.

## 8. Custos estimados

| Serviço | Custo |
|---|---|
| Cloud Run (mínimo de 0 instâncias, 256 MiB, poucos acessos) | dentro do nível gratuito |
| Cloud Build | nível gratuito de minutos |
| Artifact Registry | 0,5 GB grátis; acima disso, centavos |
| Storage do código-fonte enviado | centavos ou zero |
| IAP no Cloud Run | sem cobrança |
| Sheets API | sem cobrança |

Expectativa: perto de US$ 0 por mês. Recomenda-se um alerta de orçamento de US$ 5 e apagar imagens antigas.

Alternativas avaliadas e descartadas:
- **Balanceador com IAP:** cerca de US$ 18/mês.
- **App Engine:** a região não pode ser mudada depois.
- **Firebase Hosting:** não tem restrição de acesso.

## 9. Projeto anterior relacionado (só como referência)

O "Agendamento Cultura Jaguariúna" (Laravel, repositório `celsolauro/agendamento-cultura-jaguariuna`) foi publicado **pelo próprio usuário** no Cloud Run (`southamerica-east1`), seguindo `docs/TESTE-CLOUD-RUN.md`. A proteção ali era uma senha de teste dentro do app, e não IAP. Este painel usa IAP porque o usuário exigiu login Google restrito.

## 10. Como o próximo assistente deve agir

- Responder em português do Brasil, de forma objetiva e pensando no uso pelo celular.
- O usuário roda os comandos. Pedir a saída de cada etapa e lembrar que ele não deve colar tokens, chaves, senhas nem códigos.
- Não sugerir `--allow-unauthenticated`, `allUsers`, chaves JSON de conta de serviço nem papéis Owner ou Editor.
- Não declarar sucesso sem os dois testes: anônimo bloqueado e conta autorizada carregando dados da cópia privada.
- Mudanças de código vão no branch `escola-das-artes-cloudrun`. Rodar `npm test` em `escola-das-artes/cloudrun/` antes de cada commit.
- Ao final, registrar a URL publicada e o resultado dos testes.
