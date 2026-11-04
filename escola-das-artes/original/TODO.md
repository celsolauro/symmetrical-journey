# Entregas

- [x] **Publicar um painel permanente da Escola das Artes.** O site conserva o logo oficial, os indicadores de professores, horas contratadas, horas executadas, alertas, críticos e excedidos. Exibe visivelmente “Demonstração · dados fictícios” e não é apresentado como base oficial.

- [x] **Entregar a leitura móvel de consumo por professor.** A página tem barras horizontais com referência visual de 60% e 80%, estados azul, amarelo, vermelho e vermelho escuro, busca por professor ou eixo, filtros por situação e eixo, ordenação por consumo ou nome e detalhe individual com histórico mensal, saldo e encaminhamento. O celular reorganiza a lista em uma coluna sem exigir gráfico com 59 nomes.

- [x] **Conectar o protótipo a uma planilha Google Sheets com dados fictícios.** A aba `Professores` é carregada pelo painel; os KPIs, a lista, as barras e os detalhes são atualizados a partir da planilha. A pessoa responsável pode testar o fluxo pela aba `Lancamentos`, que recalcula a aba de professores. A fonte de teste contém somente exemplos fictícios.

- [x] **Executar varredura de vulnerabilidades depois da integração.** Foram revisados sintaxe, segredos, recursos externos, inserção de HTML, dependências e exposição da fonte. A versão está aprovada somente para a planilha fictícia publicamente legível; o resultado e as condições de segurança estão registrados em `SECURITY_AUDIT.md`.

- [ ] **Implantar a versão operacional privada com dados reais.** Antes de substituir os dados fictícios, remover a integração JSONP pública e criar acesso autenticado a uma planilha privada via backend/BFF ou Web App do Apps Script. A fonte deve ficar compartilhada somente com a direção e a pessoa alimentadora, com permissão de edição restrita à aba de lançamentos para esta última.
