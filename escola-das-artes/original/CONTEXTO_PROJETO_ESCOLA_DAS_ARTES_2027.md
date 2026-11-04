# Contexto do Projeto — Escola das Artes 2027

**Última atualização:** 24/10/2026
**Município:** Jaguariúna/SP
**Secretaria responsável:** Secretaria de Cultura
**Projeto WebDev:** `/home/ubuntu/escolaarte`
**Status geral:** protótipo funcional publicado; versão operacional privada ainda não implantada.

## 1. Objetivo do projeto

A Secretaria de Cultura está estruturando a gestão da Escola das Artes para 2027, incluindo credenciamento e contratação de professores/oficineiros, turmas projetadas, contratos, cargas horárias e medições mensais.

O objetivo do painel é permitir que a direção acompanhe, principalmente pelo celular:

- professores cadastrados;
- horas contratadas e horas executadas;
- percentual de consumo de cada contrato;
- saldo de horas;
- professores que atingiram 60% ou mais;
- contratos em nível crítico, a partir de 80%;
- contratos excedidos, a partir de 100%;
- histórico mensal e encaminhamento sugerido para análise.

A base real deverá contemplar aproximadamente **59 professores**. O protótipo atual usa somente **12 registros fictícios** para demonstrar o funcionamento e preservar a segurança dos dados.

## 2. Decisões administrativas já tomadas

Durante a revisão preparatória do ETP, TR e edital, foram adotadas as seguintes decisões de projeto:

1. Admitir tanto pessoas físicas quanto pessoas jurídicas no credenciamento, conforme decisão da Administração.
2. Retirar a categoria HCT, por representar complexidade operacional desnecessária para o controle pretendido.
3. Controlar o consumo pelo total de horas contratadas e horas executadas.
4. Utilizar os seguintes limites no painel:
   - abaixo de 60%: normal;
   - de 60% a 79,9%: alerta;
   - de 80% a 99,9%: crítico;
   - a partir de 100%: excedido.
5. Permitir que a direção acompanhe os contratos sem precisar interpretar um gráfico com 59 nomes; a visualização principal será uma lista vertical com barras horizontais.
6. A alimentação mensal deverá ocorrer por registros de competência, professor, horas executadas, horas projetadas no mês e referência da nota fiscal/medição.

## 3. Documentos administrativos de referência

Foram recebidos, analisados e revisados documentos relacionados ao credenciamento da Escola das Artes 2027:

- `/home/ubuntu/upload/ETP_Escola_das_Artes_2027_Consolidado.docx`
- `/home/ubuntu/upload/TR_Escola_das_Artes_2027_Consolidado.docx`
- `/home/ubuntu/upload/Edital_Completo_Escola_das_Artes_2027_Consolidado.docx`
- `/home/ubuntu/upload/ETP_Escola_das_Artes_2027_Blindado.docx`
- `/home/ubuntu/upload/TR_Escola_das_Artes_2027_Blindado.docx`
- `/home/ubuntu/upload/Edital_Completo_Escola_das_Artes_2027_Blindado.docx`
- `/home/ubuntu/upload/CRONOGRAMADEAULASPARAOCELSO.docx`

As versões revisadas finais, que incorporam a admissão de pessoas físicas e a retirada da HCT, estão em:

- `/home/ubuntu/ETP_Escola_das_Artes_2027_PF_sem_HCT_revisado.docx`
- `/home/ubuntu/TR_Escola_das_Artes_2027_PF_sem_HCT_revisado.docx`
- `/home/ubuntu/Edital_Completo_Escola_das_Artes_2027_PF_sem_HCT_revisado.docx`

Entregáveis de análise administrativa:

- `/home/ubuntu/relatorio-analise-etp-tr-edital-escola-das-artes-2027.md`
- `/home/ubuntu/relatorio-validacao-versoes-blindado-escola-das-artes-2027.md`
- `/home/ubuntu/nota-final-PF-sem-HCT-escola-das-artes-2027.md`
- `/home/ubuntu/nota-de-revisao-escola-das-artes-2027.md`

Esses documentos são materiais de trabalho administrativo e devem continuar separados do conteúdo público do painel.

## 4. Planilha Excel de referência

Foi criada uma planilha inicial de controle com abas, fórmulas, barras de consumo, alertas e dashboard:

`/home/ubuntu/Planilha_Controle_Escola_das_Artes_2027.xlsx`

Ela serviu como referência para a estrutura do Google Sheets. A lógica principal é acompanhar o contrato por professor e medir as horas executadas mensalmente.

## 5. Google Sheets do protótipo

**Planilha:** Escola das Artes 2027 — Protótipo de Controle
**Link:** https://docs.google.com/spreadsheets/d/1hO9u9bfNCcl4ukPH5GVXWQvwn2a0tZVxpEf2GR9ag6g/edit
**ID:** `1hO9u9bfNCcl4ukPH5GVXWQvwn2a0tZVxpEf2GR9ag6g`

A planilha contém dados fictícios e está legível por link exclusivamente para viabilizar a demonstração do site estático. A permissão pública é um limite de segurança conhecido e **não deve ser mantida para dados reais**.

### Abas da planilha

#### `Professores`

Aba calculada e usada pelo painel. Estrutura principal:

| Coluna | Conteúdo |
|---|---|
| A | Código do professor |
| B | Professor |
| C | Eixo |
| D | Contrato |
| E | Horas contratadas |
| F | Horas executadas, calculadas a partir de `Lancamentos` |
| G | Percentual de consumo |
| H | Status: NORMAL, ALERTA 60%, CRÍTICO ou EXCEDIDO |
| I | Saldo de horas |
| J | Última competência |
| K:P | Histórico mensal de janeiro a junho de 2027 |
| Q | Encaminhamento sugerido |
| R | Cor institucional da identificação |

#### `Lancamentos`

É a única aba prevista para alimentação mensal pela pessoa responsável:

| Coluna | Conteúdo |
|---|---|
| A | Competência, por exemplo `2027-01` |
| B | Código do professor |
| C | Nome do professor |
| D | Contrato |
| E | Horas executadas no mês |
| F | Horas projetadas no mês |
| G | Referência da nota fiscal/medição |
| H | Observação |

Cada linha representa a medição de um professor em uma competência. Ao inserir novos lançamentos, as fórmulas da aba `Professores` recalculam o total, o percentual, o status e o saldo.

#### `Turmas`

Cadastro inicial de turmas projetadas, contendo código da turma, eixo, curso/oficina, local, dia, horário, horas previstas, professor vinculado e situação.

#### `Parametros`

Contém os limites de alerta:

- alerta: `0,60`;
- crítico: `0,80`;
- excedido: `1,00`.

Também identifica que a planilha está em modo `PROTÓTIPO`.

#### `Instrucoes`

Explica o fluxo para a pessoa alimentadora e reforça que somente a aba `Lancamentos` deve ser utilizada na rotina mensal.

As abas de cadastro, fórmulas, parâmetros e instruções foram protegidas para preservar a estrutura. A planilha ainda não foi compartilhada nominalmente com a pessoa alimentadora porque o respectivo endereço Google não foi informado.

## 6. Site publicado

**URL permanente:** https://escolaarte-jp7sdud3.manus.space
**Versão publicada:** `12fc157d6f7a7e3aadfb6f7b43e483452243d3a4`
**Commit:** `12fc157d6f7a7e3aadfb6f7b43e483452243d3a4`

### Funcionalidades atuais

O site apresenta:

- logo oficial da Escola das Artes;
- identidade visual azul, amarela, vermelha e vermelho-escura conforme o consumo;
- KPIs de professores, horas contratadas, horas executadas, alertas, críticos e excedidos;
- barras horizontais individuais com marcações de 60%, 80% e 100%;
- busca por professor, eixo ou código;
- filtros por situação e eixo;
- ordenação por consumo ou nome;
- detalhe individual em modal/folha inferior no celular;
- saldo contratual;
- histórico mensal;
- encaminhamento sugerido;
- alternância de tema claro/escuro;
- layout responsivo para celular e desktop;
- botão de atualização que consulta novamente o Google Sheets;
- identificação visível de que se trata de demonstração com dados fictícios.

### Estrutura técnica

O projeto é uma aplicação estática, sem servidor, banco de dados, autenticação ou dependências NPM:

- `/home/ubuntu/escolaarte/public/index.html`: interface, estilos e lógica JavaScript;
- `/home/ubuntu/escolaarte/public/assets/`: ativos locais do site;
- `/home/ubuntu/escolaarte/public/manus-routes.json`: manifesto da rota `/`;
- `/home/ubuntu/escolaarte/app.config.ts`: metadado do logo do projeto;
- `/home/ubuntu/escolaarte/plan.md`: plano de implementação;
- `/home/ubuntu/escolaarte/TODO.md`: entregas e pendências;
- `/home/ubuntu/escolaarte/SECURITY_AUDIT.md`: auditoria de segurança.

O build publicado usa a pasta `public/` diretamente, com comando `true`, sem instalação de pacotes.

### Como a ligação atual funciona

O frontend contém o ID da planilha de protótipo e consulta a aba `Professores` pelo endpoint de visualização do Google Sheets (`gviz`) usando JSONP. O navegador interpreta a resposta e recalcula a apresentação dos dados.

Essa técnica funciona para a demonstração, mas é deliberadamente inadequada para dados reais porque exige uma fonte acessível por link e deixa o identificador da planilha no código público.

## 7. Segurança e limites obrigatórios

A auditoria está em:

`/home/ubuntu/escolaarte/SECURITY_AUDIT.md`

O veredito é:

> Aprovado somente para demonstração com dados fictícios públicos. Reprovado para dados reais privados.

Não inserir na planilha pública do protótipo:

- nomes reais de professores;
- CPF, CNPJ, e-mail ou telefone;
- contratos reais;
- notas fiscais reais;
- dados bancários;
- dados de alunos;
- documentos de habilitação;
- qualquer informação administrativa restrita.

O marcador “Demonstração · dados fictícios” não é um controle de acesso. `noindex` também não impede que alguém com o link consulte a planilha.

Antes da operação real, é obrigatório:

1. criar uma planilha privada de produção ou revogar a permissão pública da planilha de teste;
2. remover o JSONP e o ID da planilha do frontend público;
3. criar uma camada privada com autenticação e autorização;
4. utilizar backend/BFF ou Web App do Google Apps Script configurado para usuários autorizados;
5. compartilhar a planilha nominalmente com a direção e a pessoa alimentadora;
6. restringir a edição da pessoa alimentadora à aba `Lancamentos`;
7. manter cadastros, parâmetros e fórmulas protegidos;
8. validar schema, tipos, limites de linhas e campos retornados;
9. confirmar CSP, `X-Content-Type-Options`, `Permissions-Policy`, `Referrer-Policy`, `X-Frame-Options` e HSTS na implantação final;
10. executar nova auditoria antes de inserir dados reais.

## 8. Tentativa de arquitetura privada

Foi avaliado o uso de Google Apps Script para preservar o mesmo painel com uma fonte privada. A documentação oficial indica que um Web App pode executar como o usuário que acessa ou como o usuário que publica, e pode restringir o acesso a usuários autenticados.

A criação automática do projeto Apps Script não foi concluída porque a autorização atual do CLI Google Workspace não possuía os escopos `script.projects` e `script.deployments`, e não havia um cliente OAuth local configurado para solicitar esses escopos adicionais.

Portanto, Apps Script privado é uma possibilidade futura, mas não está implementado neste projeto.

## 9. Próximas etapas recomendadas

### Etapa 1 — validação com a equipe

Usar o site e a planilha fictícia em apresentação. Testar o lançamento de uma linha em `Lancamentos`, verificar o recálculo da aba `Professores`, atualizar o painel e observar a mudança de cor/alerta.

### Etapa 2 — preparação dos dados reais

Importar a lista real de aproximadamente 59 professores, contratos, cargas horárias, turmas, locais e horários. Conferir se os códigos de professor e contrato são únicos e padronizados.

### Etapa 3 — definição de usuários

Informar os endereços Google nominais da direção e da única pessoa que alimentará as medições. A pessoa alimentadora deve ter edição controlada somente nos lançamentos; a direção deve ter acesso de leitura ao painel e, se necessário, à planilha privada.

### Etapa 4 — integração privada

Escolher entre backend/BFF com OAuth Google ou Web App Apps Script com controle de acesso. Remover o JSONP público, substituir a fonte de dados no site, testar login, permissões, falhas e atualização mensal.

### Etapa 5 — implantação oficial

Criar uma nova versão do site, executar auditoria de segurança, confirmar headers HTTP, revisar a planilha privada e somente então publicar como ferramenta operacional.

## 10. Escopo futuro de comunicação e campanha

A nova marca da Escola das Artes — Jaguariúna já foi enviada e considerada como referência visual. A campanha de lançamento da marca ainda é um projeto separado do painel de gestão e pode incluir:

- peças digitais e impressas;
- vídeo institucional ou de lançamento;
- versões para redes sociais;
- possibilidade de um game ou experiência interativa de divulgação.

Nenhum vídeo ou game está integrado ao site de gestão atual. Essa frente deve ser planejada depois que o fluxo administrativo do painel estiver validado.

## 11. Instrução para futuras retomadas

Ao retomar este projeto:

1. ler este arquivo antes de alterar o site ou a planilha;
2. preservar o site publicado e os dados fictícios existentes;
3. não inserir dados reais na planilha do protótipo;
4. não transformar a integração JSONP em solução de produção;
5. consultar `SECURITY_AUDIT.md` antes de qualquer nova publicação;
6. tratar a implantação privada como uma etapa distinta, com autenticação e autorização;
7. solicitar confirmação antes de publicar mudanças que alterem o comportamento público do site;
8. manter a distinção entre o painel demonstrativo, a planilha de teste e o futuro sistema operacional.
