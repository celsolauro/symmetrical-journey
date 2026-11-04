# Painel Escola das Artes: publicação privada no Google Cloud

Esta pasta é a **configuração separada de deploy**. Os arquivos recebidos do Manus estão intactos em `../original/`.

## Arquitetura escolhida

```
iPhone/Safari ──► Cloud Run (URL *.run.app) com IAP ativado
                    │  IAP exige login Google e só libera celsolauro@gmail.com
                    │  Cloud Run não aceita chamadas não autenticadas (sem allUsers)
                    ▼
              server.js (Node 22, sem dependências npm)
                    │  confere de novo o cabeçalho assinado do IAP (assinatura, audiência, e-mail)
                    │  token do metadata server com escopo spreadsheets.readonly
                    ▼
              Sheets API ──► planilha PRIVADA, compartilhada só como "Leitor" com a conta de serviço
```

**Por que Cloud Run + IAP direto:** desde 2025 o IAP pode ser ativado direto no Cloud Run, sem balanceador de carga, domínio ou certificado. É a opção mais simples do Google Cloud que garante login restrito.
- **App Engine + IAP:** exige criar um app App Engine, cuja região não pode ser mudada depois.
- **Balanceador + IAP:** custa cerca de US$ 18/mês só pela regra de encaminhamento.
- **Firebase Hosting:** não oferece restrição de acesso.

## O que mudou em relação ao original

| Original (Manus) | Versão Cloud Run |
|---|---|
| ID da planilha e JSONP `gviz` no navegador | removidos; o navegador chama só `/api/professores` no mesmo domínio |
| planilha precisa ser pública por link | planilha privada, lida no servidor com escopo somente leitura |
| sem autenticação | IAP restrito a `celsolauro@gmail.com`, conferido também no servidor |
| sem cabeçalhos de segurança | CSP sem script inline, nosniff, X-Frame-Options DENY, HSTS, Permissions-Policy, Referrer-Policy |
| script inline | `public/app.js` (mesmo código, só o carregamento de dados mudou) |
| logo em `/manus-storage/...` | `/assets/logo-escola-das-artes.png` + ícone para a Tela de Início |

O visual, os KPIs, as barras, os filtros, a ordenação, o modal, o tema escuro e o selo "Demonstração · dados fictícios" foram mantidos.

## Testes locais (já executados)

`npm test`: 6 testes, com Sheets e chaves do IAP simulados e JWT ES256 reais.
- **Bloqueios:** sem cabeçalho, outro e-mail, outra audiência, token expirado, outro emissor ou chave errada recebem 403.
- **Página:** usuário autorizado recebe a página com os cabeçalhos de segurança e nenhum ID de planilha.
- **API:** devolve só os 9 campos validados.
- **Recusas:** travessia de caminho e POST são recusados.
- **Cloud Run:** a verificação do IAP não pode ser desligada.

## Custos estimados (confira em cloud.google.com/pricing)

| Serviço | Uso esperado | Custo provável |
|---|---|---|
| Cloud Run (mín. 0 instâncias, 256 MiB) | poucos acessos por dia | dentro do nível gratuito (2 mi de requisições, 180 mil vCPU-s, 360 mil GiB-s/mês) |
| Cloud Build | 1 a 2 min por deploy | nível gratuito mensal de minutos de build |
| Artifact Registry | imagem de ~50 MB por versão | 0,5 GB grátis; acima disso, centavos por GB/mês |
| Cloud Storage (código-fonte enviado no deploy) | < 1 MB por deploy | centavos ou zero |
| IAP | — | sem cobrança no Cloud Run |
| Sheets API | — | sem cobrança (há cotas) |

**Requisito:** o projeto precisa ter uma conta de faturamento vinculada, porque o Cloud Run exige faturamento mesmo dentro do nível gratuito. Recomendo criar um **alerta de orçamento** de, por exemplo, US$ 5 em Faturamento > Orçamentos e alertas. Apague imagens antigas no Artifact Registry de tempos em tempos.

## Papéis IAM

Se você é **Proprietário** do seu próprio projeto `surrebiflu-1`, não é preciso conceder nada. Se não for, o administrador deve conceder à sua conta somente estes papéis:

- `roles/serviceusage.serviceUsageAdmin`: ativar as APIs, uma única vez
- `roles/iam.serviceAccountCreator`: criar a conta de serviço, uma única vez
- `roles/iam.serviceAccountUser` **na conta de serviço** `escola-artes-leitor@...`, e não no projeto todo
- `roles/run.sourceDeveloper` e `roles/run.admin`: deploy a partir do código e política IAM do serviço
- `roles/iap.admin`: ativar o IAP e definir quem acessa
- `roles/logging.viewer`: conferir os logs do teste

A conta de serviço do app **não recebe nenhum papel no projeto**. O único acesso dela é "Leitor" na planilha privada, concedido pelo Drive.

Se o build falhar com `PERMISSION_DENIED` envolvendo a conta `PROJECT_NUMBER-compute@developer.gserviceaccount.com`, conceda a ela `roles/run.builder`, que é o papel mínimo do Cloud Build para deploy a partir do código.

## Passo a passo

### Manual 1: criar a planilha privada (no Google Drive, com a sua conta)
1. Abra a planilha de demonstração e use **Arquivo > Fazer uma cópia**. Não altere a original.
2. Na cópia, abra **Compartilhar**, deixe *Acesso geral* em **Restrito** e confira que só você aparece.
3. Copie o ID da cópia, que é o trecho entre `/d/` e `/edit` na URL. O ID não é segredo, mas fica fora do código.
4. A cópia continua com **dados fictícios**. Dados reais só depois de confirmar e de uma nova auditoria.

### Manual 2: abrir o Cloud Shell já autenticado
Acesse https://shell.cloud.google.com com `celsolauro@gmail.com`. O Cloud Shell já vem logado com a sua conta, e nenhum código ou senha passa por terceiros. Coloque esta pasta lá, por `git clone` do repositório ou pelo menu *Upload*, e rode:

```bash
cd escola-das-artes/cloudrun
gcloud config set project surrebiflu-1
./deploy/deploy.sh verificar        # somente leitura
./deploy/deploy.sh preparar         # ativa APIs e cria a conta de serviço (pede confirmação)
```

### Manual 3: compartilhar a planilha privada com a conta de serviço
Compartilhe com `escola-artes-leitor@surrebiflu-1.iam.gserviceaccount.com` como **Leitor** e desmarque "Notificar pessoas".

### Publicar e testar
```bash
./deploy/deploy.sh publicar ID_DA_COPIA_PRIVADA
```
O script implanta com `--no-allow-unauthenticated --iap`, libera o IAP só para o seu e-mail e audita as políticas. Em seguida, testa se o acesso anônimo é bloqueado e se a planilha não é legível sem login. Se qualquer verificação falhar, o serviço é **bloqueado automaticamente** com ingress `internal`.

Depois, abra a URL mostrada numa janela anônima e entre com `celsolauro@gmail.com`. Por fim, rode `./deploy/deploy.sh logs` para confirmar o `200` em `/api/professores`.

### Se o Google recusar o login da conta @gmail.com
Isso pode acontecer quando o projeto pertence a uma organização. Nesse caso, configure um **cliente OAuth personalizado** no IAP, sempre pelo Console e com a sua conta:
1. Em **Google Auth Platform > Branding/Público**, escolha o tipo **Externo** e adicione `celsolauro@gmail.com` como usuário de teste.
2. Em **Clientes**, crie um *ID do cliente OAuth* do tipo **Aplicativo da Web**.
3. No mesmo cliente, adicione o URI de redirecionamento `https://iap.googleapis.com/v1/oauth/clientIds/SEU_CLIENT_ID:handleRedirect`.
4. Em **Segurança > Identity-Aware Proxy**, selecione o serviço `escola-das-artes`, abra **Configurações** e informe o ID e a chave secreta do cliente.

A chave secreta fica só no Console. Não a cole em chats nem em arquivos.

## Adicionar à Tela de Início do iPhone
1. Abra a URL no **Safari** e faça login com `celsolauro@gmail.com`.
2. Toque em **Compartilhar** (quadrado com seta) e depois em **Adicionar à Tela de Início**.
3. Mantenha o nome "Escola das Artes" e toque em **Adicionar**.
4. Se ao abrir pelo ícone o login entrar em ciclo, remova o ícone e adicione de novo com a opção **"Abrir como App Web" desligada**. Assim o atalho abre no próprio Safari, que mantém a sessão do Google.

A sessão do IAP expira periodicamente. Quando isso acontecer, o painel mostra "Sessão expirada · recarregue a página".
