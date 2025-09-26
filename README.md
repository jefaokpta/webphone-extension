# Ramal Vip — Extensão de Webphone para Google Chrome (MV3)

Extensão do Chrome para fazer e receber chamadas VoIP (SIP) diretamente no navegador usando JsSIP, com UI simples no popup e lógica principal planejada para um Service Worker (Manifest V3).

Este README foi escrito para humanos e agentes de IA manterem, depurarem e evoluírem o projeto com segurança e qualidade.


## Sumário
- Visão geral
- Tecnologias e frameworks
- Estrutura do projeto
- Como instalar (carregar no Chrome)
- Configuração (credenciais e ambiente)
- Arquitetura e fluxo de execução
- Guia de desenvolvimento
- Debugging e troubleshooting
- Segurança e privacidade
- Roadmap e TODOs
- Como contribuir
- FAQ e Glossário
- Referências


## Visão geral
- Objetivo: discar e receber ligações SIP diretamente no navegador, com interface mínima no popup da extensão.
- Estado atual: possui popup que envia comandos (ligar/desligar) para um Service Worker (MV3) via `chrome.runtime.sendMessage`. O arquivo do Service Worker (service-worker.js) ainda não está implementado no repositório e é um TODO claro.
- Público: operadores de atendimento, times internos, e desenvolvedores que desejam integrar telefonia ao browser.


## Tecnologias e frameworks
- JsSIP (SIP sobre WebSockets): https://jssip.net/documentation/getting_started
- Bootstrap 5.3 (CSS utilitário e componentes): https://getbootstrap.com/docs/5.3/getting-started/introduction/
- Chrome Extensions Manifest V3 (Service Worker, Offscreen API, Storage):
  - MV3: https://developer.chrome.com/docs/extensions/mv3
  - Offscreen: https://developer.chrome.com/docs/extensions/reference/offscreen

Boas práticas técnicas adotadas:
- DRY (Don't Repeat Yourself): https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
- Immutability (Objetos imutáveis): https://en.wikipedia.org/wiki/Immutable_object


## Estrutura do projeto
Arquivos principais no repositório:
- manifest.json — Manifest V3, define permissões, popup e background (service worker).
- popup.html — UI do discador (entrada de telefone e botões ligar/desligar).
- popup.js — Lógica do popup; envia mensagens `dial` e `hangup` para o Service Worker.
- libs/
  - jssip.min.js — Biblioteca JsSIP.
  - bootstrap-5.3.8-dist/ — CSS/JS do Bootstrap.
  - credentials.js — credenciais de exemplo (NÃO usar em produção, ver seção de Segurança).

Observação: `background.service_worker` aponta para `service-worker.js`, mas esse arquivo ainda não existe no repositório (TODO).


## Como instalar (carregar no Chrome)
1. Abra chrome://extensions no Chrome.
2. Ative o modo Desenvolvedor (canto superior direito).
3. Clique em "Carregar sem compactação" e selecione a pasta do projeto.
4. A extensão “Ramal Vip” deve aparecer com o popup habilitado.

Permissões pedidas atualmente (manifest.json):
- activeTab, tabs — interação com guias ativas.
- storage — persistência leve de dados.
- offscreen — criação de documento offscreen (útil para áudio/RTC em MV3).


## Configuração (credenciais e ambiente)
- libs/credentials.js contém credenciais de EXEMPLO, com usuário, senha, domínio/porta e token. Isso NÃO deve ser usado em produção ou commitado com dados reais.
- Em produção, use `chrome.storage` para guardar e ler credenciais com consentimento do usuário, ou um fluxo de autenticação seguro. Evite credenciais hardcoded.
- Para SIP com JsSIP, normalmente você precisará de:
  - WebSocket Secure (WSS) do seu servidor SIP/PABX (ex.: wss://dominio:porta).
  - Usuário (SIP URI), senha, domínio/realm.
  - Configurações de ICE/STUN/TURN para WebRTC, se necessário.

Sugestão de estratégia segura:
- Coletar as credenciais no popup (ou em uma página de opções) e salvar via `chrome.storage.sync`.
- O Service Worker lê as credenciais no startup e cria/gerencia o `JsSIP.UA`.
- Tokens devem ter expiração curta e ser renováveis; nunca expor segredos em repositório público.


## Arquitetura e fluxo de execução
- popup.html + popup.js: UI mínima (campo Telefone, botões Ligar/Desligar).
  - Ao clicar em Ligar: `chrome.runtime.sendMessage({ type: 'dial', phoneNumber })`.
  - Ao clicar em Desligar: `chrome.runtime.sendMessage({ type: 'hangup' })`.
- service-worker.js (TODO):
  - Recebe mensagens via `chrome.runtime.onMessage`.
  - Gerencia a instância `JsSIP.UA` (registrar conta, eventos de sessão, midia).
  - Mantém estado das chamadas (ativa/ociosa), preferencialmente de forma imutável (ver Guia).
  - Pode criar um documento offscreen para reprodução/captura de áudio em MV3, se necessário (Offscreen API).
  - Envia atualizações de status de volta ao popup via `chrome.runtime.sendMessage` ou `chrome.runtime.onMessage`/`tabs`.

Fluxo típico de discagem (esperado):
1. Usuário digita número no popup e clica em "Ligar".
2. Popup manda `dial` ao Service Worker.
3. SW valida credenciais, cria sessão com `ua.call(target, options)` do JsSIP.
4. Eventos de `progress`, `accepted`, `confirmed`, `ended`, `failed` são tratados.
5. SW atualiza UI (status no popup) e gerencia áudio via offscreen.

Fluxo de chamada entrante (futuro):
- SW escuta `newRTCSession` com `originator === 'remote'` e decide notificar o usuário, exibir UI de atender/recusar e conectar mídia.


## Guia de desenvolvimento
Princípios principais:
- DRY: extraia funções utilitárias para evitar duplicação (ex.: logger, validação de número, normalização de estado).
- Imutabilidade: trate o estado como valores novos a cada mudança (não mutar in-place). Facilita debugging e evita efeitos colaterais.

Exemplos práticos:
- Logger padronizado (já existe no popup):
  - No Service Worker, siga padrão: `[SW] 2025-09-26 Mensagem`.
- Estado imutável (pseudo):
  ```js
  let state = { call: null, status: 'idle' };
  const setState = (patch) => { state = { ...state, ...patch }; broadcast(state); };
  ```
- DRY na validação:
  ```js
  const normalizeNumber = (n) => n.replace(/\D/g, '');
  const isValidNumber = (n) => normalizeNumber(n).length >= 8;
  ```

Padrões recomendados:
- Módulos em ES Modules (MV3 permite `type: module`), evitar variáveis globais.
- Funções puras para transformar estado; side effects (SIP/RTC) concentrados em adaptadores.
- Tratamento de erros consistente, com mensagens amigáveis no popup.
- Comentários breves e autoexplicativos; nomes claros.

Estilo de código:
- JavaScript moderno (ES2020+), `const`/`let`.
- Use `async/await` para assíncrono e try/catch com logs úteis.
- Se desejar, adicione ESLint/Prettier (não incluído ainda) e um script de lint.


## Debugging e troubleshooting
Popup:
- Clique com botão direito no ícone da extensão > "Inspecionar popup" para abrir o console.
- O arquivo popup.js já loga com prefixo `[POPUP]`.

Service Worker (MV3):
- Em chrome://extensions, clique em "Service worker" da extensão para abrir o console do SW.
- Use logs `[SW]` e, quando necessário, habilite logs do JsSIP:
  ```js
  // no SW, quando implementar:
  // import JsSIP from './libs/jssip.min.js';
  JsSIP.debug.enable('JsSIP:*');
  ```

Áudio/Mídia:
- Em MV3, a reprodução/captura pode exigir Offscreen Document. Veja a Offscreen API.
- Teste permissões e origens seguras (HTTPS/WSS). Certifique-se de que o servidor SIP oferece WSS válido.

Problemas comuns:
- Conexão WSS falha: verifique certificado TLS e porta correta do PABX.
- 401/403 no registro SIP: verifique usuário/senha/realm.
- Áudio sem som: revisar criação de elemento <audio> no offscreen e `setSinkId` (quando aplicável).
- Mensagem não chega ao SW: confirme que o arquivo `service-worker.js` existe, está listado no manifest e o SW está ativo.


## Segurança e privacidade
- Não commitar credenciais reais (arquivo libs/credentials.js deve conter apenas placeholders). Considere removê-lo antes de publicar o repositório.
- Sempre usar WSS (TLS) para SIP/WebSocket.
- Armazenar segredos no `chrome.storage` de forma mínima e com consentimento.
- Revogar e rotacionar tokens periodicamente; preferir OAuth/OIDC quando possível.
- Não registrar informações sensíveis em logs (sanitizar números/token).
- Respeitar LGPD: informar ao usuário quais dados são processados e por quê.


## Roadmap e TODOs
- Implementar `service-worker.js` com:
  - Inicialização e registro do `JsSIP.UA`.
  - Manipulação de `dial`/`hangup` e eventos de sessão.
  - Integração com Offscreen para áudio.
  - Canal de mensagens de status com o popup.
- Tela de configurações (options page) para credenciais.
- Notificações e UI para chamadas entrantes.
- Integração de lint/format e testes.


## Como contribuir
- Abra issues descrevendo claramente problema/feature, passos para reproduzir e contexto.
- Siga DRY e Imutabilidade nas PRs. Escreva commits descritivos (ex.: `feat(sip): add UA registration with retry`).
- Evite adicionar dependências pesadas sem discussão.
- Inclua logs claros e tratamento de erros.


## FAQ e Glossário
- O que é JsSIP? Biblioteca JS para SIP sobre WebSocket, integrando com WebRTC no browser.
- O que é Offscreen? Um documento sem UI em MV3 para tarefas como áudio, disponível mesmo sem páginas ativas.
- SIP: Protocolo de Sinalização para iniciação/terminação de sessões de voz/vídeo.
- WSS: WebSocket seguro (TLS) — necessário para SIP no browser em produção.


## Referências
- JsSIP Getting Started: https://jssip.net/documentation/getting_started
- Bootstrap 5.3: https://getbootstrap.com/docs/5.3/getting-started/introduction/
- Chrome Extensions MV3: https://developer.chrome.com/docs/extensions/mv3
- Offscreen API: https://developer.chrome.com/docs/extensions/reference/offscreen
- DRY: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
- Immutability: https://en.wikipedia.org/wiki/Immutable_object


---
Observação final: Este README reflete o estado atual do repositório em 2025-09-26. Atualize-o conforme novos arquivos (especialmente `service-worker.js`) forem adicionados ou a arquitetura evoluir.