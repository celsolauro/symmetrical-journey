# Plano — Painel da Escola das Artes 2027

## Escopo aprovado

Transformar a demonstração de acompanhamento de contratos e horas-aula em um site permanente para apresentação institucional. Nesta etapa, o site está conectado a uma planilha Google Sheets **de protótipo**, identificada visivelmente como demonstração e alimentada apenas com dados fictícios. A fonte será usada para validar o fluxo de atualização do painel antes da implantação institucional.

## Implementação

O site é uma aplicação estática publicada a partir da pasta `public/`. A interface lê a aba `Professores` da planilha de protótipo por meio do endpoint de visualização do Google Sheets e atualiza os indicadores, filtros, barras de consumo e detalhes individuais a cada carregamento ou acionamento do botão de atualização.

A planilha de teste possui as abas `Professores`, `Turmas`, `Lancamentos`, `Parametros` e `Instrucoes`. A aba `Lancamentos` é a única prevista para alimentação mensal; as demais sustentam cadastros, fórmulas e limites. Os patamares são 60% para alerta, 80% para crítico e 100% para excedido.

Essa integração direta é deliberadamente limitada a **dados fictícios que podem ser públicos**. O endpoint exige que a planilha seja acessível por link para a página estática conseguir lê-la. Portanto, esta arquitetura não pode receber dados reais, nomes reais, contratos, notas fiscais, dados pessoais ou qualquer informação administrativa restrita.

Para a implantação real, a próxima versão deverá remover o ID da planilha e o JSONP do navegador, introduzir autenticação e autorização por usuário e acessar uma planilha privada por backend/BFF ou por um Web App do Apps Script configurado para usuários autorizados. A pessoa alimentadora terá edição somente na aba de lançamentos, enquanto a direção utilizará somente o painel.

## Design

**Movimento de design:** arquitetura da informação institucional, inspirada em painéis públicos de leitura rápida e em sinalização funcional.

**Princípios:** decisão antes de detalhe; leitura vertical no celular; cor como semântica e não ornamento; visibilidade constante de que os dados são fictícios.

**Cor:** azul institucional para consumo normal; amarelo para o primeiro limite; vermelho para criticidade; vermelho escuro para excedente. Fundos claros e superfícies com bordas discretas preservam legibilidade em ambiente administrativo.

**Layout:** cabeçalho compacto, indicadores em blocos e lista vertical como visualização principal. No desktop, a lista distribui detalhes em colunas; no celular, cada professor ocupa um cartão de leitura imediata.

**Elementos de assinatura:** barras horizontais marcadas em 60% e 80%; selo de demonstração; avatar tipográfico por professor.

**Interação e animação:** filtros respondem imediatamente no navegador; o detalhe abre em folha inferior no celular; transições curtas e sem movimento contínuo; preferência de movimento reduzido é respeitada.

**Tipografia:** Manrope para hierarquia e Source Sans 3 para leitura de dados. O logo oficial é usado como ativo real no cabeçalho.

**Essência da marca:** um painel institucional simples que permite à Secretaria enxergar, no celular, onde a carga contratada exige decisão. Personalidade: clara, responsável e acessível.

**Voz:** direta e orientada à ação. Exemplos: “Onde a carga horária precisa de atenção?” e “Verificar excedente, saldo contratual e necessidade de regularização.”

## Estrutura do projeto

- `public/index.html`: interface estática, integração JSONP exclusiva da planilha fictícia e interações no navegador.
- `public/assets/`: logo oficial da Escola das Artes utilizado no site.
- `public/manus-routes.json`: manifesto da rota pública.
- `app.config.ts`: metadado de logo do projeto com URL pública durável.
- `TODO.md`: acompanhamento dos resultados a entregar.
- `SECURITY_AUDIT.md`: riscos, controles e limites de uso da versão conectada.

## Publicação

A configuração de build publica diretamente `public/`, sem instalação de dependências. A versão conectada passará por varredura de segurança específica de dados da planilha antes do checkpoint. Ela será publicada somente como protótipo demonstrativo e não como base operacional oficial.
