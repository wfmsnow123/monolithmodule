# Monolith: QoL Mods

Quatro módulos pequenos de qualidade de vida, incorporados num só, adaptados à V13 (13.351) e ao dnd5e 5.2, em português. Cada recurso liga e desliga sozinho e tem sua própria janela de opções.

Substitui Autocomplete Inline Properties, DF Settings Clarity, GM Vision e Hide GM Rolls. Não ative os originais junto: enquanto um original estiver ativo, o recurso equivalente fica desligado, e o Mestre recebe um aviso oferecendo desativá-lo.

## Recursos

### Autocompletar propriedades

Lista navegável de propriedades nos campos de chave e de fórmula. Passe o mouse no campo e clique no botão **@**, ou digite **@** com o campo em foco. Na lista: setas escolhem, **Tab** completa o nível, **Enter** insere, **Esc** fecha, o botão de seta sobe um nível.

Onde funciona:

- **Efeitos Ativos** (core): a chave da mudança (caminho do ator, começando em `system.`) e o valor (`@fórmulas` com a roll data do ator).
- **dnd5e 5.2**: bônus, fórmulas, usos máximos e consumo nas atividades (ataque, dano, cura, teste, salvaguarda...), nos itens e nas janelas de configuração do ator (habilidades, perícias, CA, PV, iniciativa, concentração, morte).

Quando o efeito ou o item não tem dono, a lista mostra os dados somados de todos os tipos de ator.

Opções: botão @ nos campos, tecla @, Efeitos Ativos, fichas do dnd5e.

### Escopo das configurações

Na janela Configurar Definições, cada configuração ganha um ícone com quem ela afeta: **mundo** (vale para todos, só o Mestre altera), **cliente** (só este navegador) ou **usuário** (salva no mundo para cada usuário, escopo novo da V13). Menus ganham a marca de "menu do Mestre" ou "menu aberto", e as configurações que pedem recarregar ganham um ícone a mais. A explicação aparece na dica do próprio Foundry.

Opções: marcar os menus, marcar o que pede recarregar, mostrar aos jogadores.

### Visão do Mestre

Um modo só do Mestre: clareia o mapa, revela a névoa, deixa a escuridão translúcida e mostra os tokens fora da visão dos tokens controlados, com listras diagonais. Tokens ocultos também ganham listras. Serve para controlar um token e ainda ver a cena como Mestre.

Alterne com **Ctrl+G** (editável em Controles) ou com o **botão direito no controle de Iluminação**; o ícone da Iluminação fica cheio com a Visão ligada. O estado fica salvo neste navegador.

Opções: botão direito na Iluminação, listras nos tokens escondidos, opacidade da escuridão. Ligar ou desligar o recurso pede para recarregar (ele troca a classe dos tokens e um filtro do canvas).

### Rolagens do Mestre

- **Esconder fórmula e dados**: nas rolagens públicas do Mestre, os jogadores veem só o total.
- **Esconder crítico e falha crítica**: tira cores e ícones de crítico das rolagens do Mestre.
- **Dice So Nice!: sem dados 3D** nas rolagens públicas do Mestre, para os jogadores.
- **Sumir com rolagens privadas do Mestre**: em vez de "rolou em privado", a mensagem nem aparece para os jogadores.
- **Sumir com rolagens privadas dos jogadores**: rolagens privadas, às cegas e só para si de um jogador somem do chat dos outros jogadores.
- **Esconder descrição dos cartões do Mestre**: cartões de item e atividade do Mestre chegam aos jogadores sem a descrição.
- **Rolar em privado por tokens ocultos**: o que o Mestre rola por um token oculto vira privado.

## Configurações

Configurar Definições > Monolith: QoL Mods: um botão **Configurar** por recurso. Cada janela tem o liga/desliga do recurso, as opções, **Restaurar padrões** e **Salvar**. Tudo é do mundo (só o Mestre), menos o estado da Visão do Mestre, que é deste navegador.

## Vindo dos módulos originais

Na primeira vez que o Mestre abre o mundo com o QoL Mods, as configurações que os originais deixaram são copiadas (mesmo com os originais desativados): o botão @ do Autocomplete, todas as opções do Hide GM Rolls e o estado do GM Vision. Se algum original ainda estiver ativo, o Mestre recebe um aviso para desativá-lo; a cópia acontece quando ele estiver desligado.

Para quem tem macros ou módulos: `game.modules.get("monolith-qol").api` tem `autocompletar` (mesmo formato da API do original: `CONST.DATA_MODE`, `PACKAGE_CONFIG`, `refreshPackageConfig`), `visaoMestre.alternar()` e `ligado(id)`. Os ganchos `aipSetup` e `aipReady` continuam sendo chamados.

## O que mudou em relação aos originais

- **Autocomplete Inline Properties**: só o core e o dnd5e (pf1, sw5e e cosmere-rpg cortados). As configurações do dnd5e foram refeitas para a 5.2 (as do original apontavam para janelas da 3.x). O original aplicava as duas configurações dos Efeitos Ativos à chave; aqui a segunda vai para o valor. Item sem ator agora usa os dados de ator genéricos de verdade. Inserir dispara `change`, então fichas que salvam ao mudar salvam. Sem template Handlebars e sem a opção de depuração.
- **DF Settings Clarity**: não precisa mais do libWrapper e não renomeia as configurações; usa a dica do core e conhece o escopo "usuário" da V13.
- **GM Vision**: só o caminho da V13 (o 2.0.5 já se prepara para a V14). Opções novas: botão direito opcional, listras opcionais e opacidade da escuridão.
- **Hide GM Rolls**: reescrito para a V13 sem jQuery e sem libWrapper (`renderChatMessageHTML` e `dnd5e.renderChatMessage`, `ChatMessage#visible` em vez de esconder por CSS e embrulhar `ChatLog#notify`). O suporte ao Better Rolls 5e, ao Ready Set Roll e ao pf2e saiu. Onde o dnd5e já resolve (CD, acerto e erro em Configurações do sistema > Visibilidade; `secret-roll`; `data-concealed`), o recurso usa o que o sistema oferece.

## Créditos e licenças

- [Autocomplete Inline Properties](https://github.com/farling42/FVTT-Autocomplete-Inline-Properties), de Cole Schultz, Johannes Loher e Farling. MIT, em [LICENSE-AIP.txt](LICENSE-AIP.txt).
- [DF Settings Clarity](https://github.com/flamewave000/dragonflagon-fvtt/tree/master/df-settings-clarity), de flamewave000. BSD-3-Clause, em [LICENSE-DF-SETTINGS-CLARITY.txt](LICENSE-DF-SETTINGS-CLARITY.txt).
- [GM Vision](https://github.com/dev7355608/gm-vision), de dev7355608. MIT, em [LICENSE-GM-VISION.txt](LICENSE-GM-VISION.txt).
- [Hide GM Rolls](https://github.com/sPOiDar/fvtt-module-hide-gm-rolls), de sPOiDar. MIT, em [LICENSE-HIDE-GM-ROLLS.txt](LICENSE-HIDE-GM-ROLLS.txt).

Os autores originais não têm relação com este módulo e não dão suporte a ele.
