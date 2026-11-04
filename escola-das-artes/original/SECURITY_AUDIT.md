# Varredura de segurança — Escola das Artes 2027

**Data:** 18/10/2026
**Projeto:** Painel Escola das Artes 2027
**Escopo desta revisão:** versão conectada a uma planilha Google Sheets de teste, com dados exclusivamente fictícios.

## Veredito executivo

**Aprovado somente para demonstração com dados fictícios públicos. Reprovado para dados reais privados.**

O painel passou a carregar os dados da aba `Professores` de uma planilha Google Sheets por JSONP (`gviz`). O fluxo funciona: os indicadores, a lista, as barras de consumo e os detalhes são calculados a partir da planilha. A contrapartida é estrutural: a planilha precisa estar acessível por link para uma página estática pública conseguir consultá-la. Portanto, qualquer pessoa que descubra a URL pode consultar a fonte de teste.

Não há chaves, tokens, senhas, CPF, CNPJ ou dados pessoais no repositório revisado. Porém, a arquitetura atual não oferece autenticação, autorização por usuário nem backend intermediário; por isso ela não pode ser usada com dados reais de contratos, docentes, notas fiscais ou qualquer informação administrativa restrita.

## Achados e tratamento

### SEC-01 — Fonte Google Sheets publicamente legível — alta se receber dados reais

O arquivo `public/index.html` contém o ID da planilha e injeta o endpoint de visualização `docs.google.com/spreadsheets/.../gviz/tq` como JSONP. O ID não é um segredo, mas identifica uma fonte que está acessível por link para o painel funcionar. A configuração `noindex` não impede acesso direto e não substitui autenticação.

**Tratamento atual:** a planilha contém somente dados fictícios para demonstração.

**Condição obrigatória para produção:** substituir o JSONP por uma integração privada. O acesso deve ocorrer por backend/BFF com autenticação e autorização, ou por Web App do Google Apps Script que execute para usuários autenticados e autorizados. O ID da planilha, as credenciais e os dados não podem ir para o navegador público.

### SEC-02 — JSONP é código executável de terceiro — média no protótipo

JSONP é carregado como script, não como JSON passivo. O painel confia no domínio Google para executar o callback de resposta. Isso é aceitável apenas para a fonte de testes sob controle da Secretaria, mas amplia a superfície de confiança e não é apropriado para informação protegida.

**Tratamento atual:** o nome da aba é constante, os parâmetros são codificados e a resposta é carregada apenas do domínio `docs.google.com`.

**Condição para produção:** eliminar JSONP e usar resposta JSON autenticada no servidor, com validação de schema, limite de linhas e tratamento de falha sem substituir o último estado válido.

### SEC-03 — Dados da planilha renderizados na interface — baixo após mitigação; médio se o schema mudar

O painel usa `innerHTML` para construir as linhas, mas os textos de nome, eixo e código passam por `escapeHtml`; cores passam por uma allowlist hexadecimal; status e classes são derivados de regras internas; horas e percentuais são convertidos para números finitos. No detalhe, títulos e encaminhamentos são aplicados com `textContent`.

Esses controles reduzem o risco de XSS para o schema atual. Qualquer campo novo vindo da planilha deve ser validado e escapado antes de entrar em HTML, atributo ou estilo. O ideal para a versão operacional é montar os elementos com `createElement` e `textContent` como defesa adicional.

### SEC-04 — Headers de segurança ainda dependem da hospedagem — média condicional

A aplicação estática não declara CSP, `X-Content-Type-Options`, `Permissions-Policy` ou `X-Frame-Options` em arquivos do projeto. A política de referenciador declarada no HTML não substitui headers HTTP. A camada de hospedagem deve ser confirmada antes de qualquer versão com dados reais.

Para a implantação privada, definir uma CSP restritiva e compatível com a implementação real. Não usar `script-src *`, `unsafe-eval` ou permissões CORS amplas para dados protegidos. O JSONP atual exigiria exceção para Google e scripts inline, outro motivo para não o levar à versão real.

### SEC-05 — Dependências externas — baixa

A página usa Google Fonts, um ativo de logo e, no protótipo, o endpoint do Google Sheets. Não há dependências NPM, `package.json` ou lockfile. As URLs externas não contêm credenciais.

Para produção, hospedar ativos críticos no próprio projeto quando possível, documentar os domínios permitidos e manter a allowlist da CSP mínima.

## Controles verificados

| Controle | Resultado |
|---|---|
| Sintaxe do JavaScript | `node --check` concluído sem erro |
| Integridade de alteração | `git diff --check` sem erro |
| Segredos e credenciais no projeto | Nenhum padrão de chave, senha ou token encontrado |
| Dependências de pacote | Não há `package.json` ou lockfile |
| Carregamento móvel | Confirmado com os 12 registros fictícios vindos do Google Sheets |
| Rota pública | Somente `/` no manifesto `manus-routes.json` |
| Inserção de dados da planilha | Textos escapados, cor validada e métricas convertidas para número |
| Operações de escrita pelo site | Não há formulário, POST, API ou gravação de dados pelo navegador |

## Procedimento seguro para a operação real

A planilha operacional deve permanecer privada no Drive. A direção e a pessoa alimentadora devem receber acesso nominal, sem compartilhamento “qualquer pessoa com o link”. A pessoa alimentadora deve lançar horas somente na aba `Lancamentos`; cadastros, parâmetros e fórmulas devem permanecer protegidos. O dashboard real precisa autenticar o usuário e consultar a planilha privada em uma camada de servidor ou Apps Script, retornando apenas os campos necessários para a visualização.

Antes de inserir qualquer dado real, revogar a permissão pública da planilha de teste ou criar uma nova planilha privada, remover o ID da planilha do frontend, ativar autenticação/autorização, validar a fonte no servidor e confirmar headers de segurança na URL final.
