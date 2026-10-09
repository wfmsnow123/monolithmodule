# Monolith: Resting Rules

Os três descansos de Monolith prontos no dnd5e 5.2 (Foundry 13), sem configurar nada. Substitui o Rest Recovery for 5E.

Fôlego, Vigília e Descanso Completo são registrados como tipos de descanso do próprio dnd5e, então o sistema recupera características, espaços e Dados de Vida pelas regras de cada um, e o módulo aplica os detalhes de Monolith antes de salvar.

| Descanso | Duração | Recupera |
| :--- | :--- | :--- |
| **Fôlego** (2 por dia) | 10 min | Características de descanso curto, 1 espaço de pacto, Dado de Vida gratuito; pode gastar Dados de Vida |
| **Vigília** (1 por dia) | 8 h | Características e espaços de magia, metade dos Dados de Vida, **sem PV**; pode gastar Dados de Vida |
| Vigília com **sono inteiro** | | também -1 de Exaustão e Dado de Vida gratuito |
| **Vigília Agitada** | | metade das características e espaços, nada acima do 3º círculo, 1 espaço de pacto |
| **Descanso Completo** | 10 h | Tudo: PV, Dados de Vida, características, espaços e -2 de Exaustão |

- Dormir de **armadura média ou pesada** tira os benefícios de sono inteiro (detectado pelo equipamento).
- **Limites por dia** (2 Fôlegos, 1 Vigília em 24 horas de jogo) são conferidos; o Mestre pode ignorar no pedido.
- **Dormir é para os Fracos**: a cada 24 horas sem Vigília, dono e Mestre recebem um cartão com o teste de Constituição (CD 10, +5 por período seguido) e um botão que rola; falha dá 1 de Exaustão.

## Pedir um descanso

O Mestre usa o botão **Descanso** na lista de jogadores (ou o ícone de cama do painel do Monolith: Regras da Casa). A janela escolhe o descanso, o sono inteiro, os fatores do **acampamento Exposto** (mostra a CD do teste em grupo) e se o grupo falhou (Vigília Agitada), quem descansa, e se o relógio avança. Cada jogador recebe o pedido e o diálogo do dnd5e abre para gastar Dados de Vida.

## Fogueira: a comida do descanso

Na Vigília e no Descanso Completo, a seção **Comida** do pedido diz se a comida é exigida, quanto cada um precisa (padrão: 1 de comida e 1 de bebida por pessoa) e quem come. Com comida exigida, o pedido acende a **Fogueira** em vez de pedir o descanso na hora:

- A janela abre para o Mestre e para os jogadores dos personagens. Ela mostra a meta (ex.: Comida 4/5, Bebida 3/5), quem come e se já tem o bastante, e a pilha com o retrato de quem trouxe, o item e a quantidade. Todos veem as mudanças ao vivo; quem fechou reabre pelo botão do cartão no chat.
- O jogador arrasta comida e bebida da ficha para a fogueira (e escolhe quantas, se for uma pilha). O item sai do inventário e vai para a pilha; enquanto a fogueira está acesa, ele pode pegar de volta.
- Comida e bebida são reconhecidas pelo nome (palavras configuráveis, sem diferenciar acento e aceitando plural: ração, comida, pão, carne... / água, odre, cantil, vinho...) ou pelo tipo Comida dos consumíveis do dnd5e. Bebida ganha de comida: "Odre de vinho" é bebida. Cada unidade da quantidade conta como uma porção.
- O Mestre clica **Comer e descansar**: cada um come o que precisa (quem trouxe come primeiro do que trouxe; ninguém come pela metade), a última refeição de quem comeu é marcada, as sobras voltam aos donos (ou ficam na pilha, pela configuração) e o descanso é pedido. **Cancelar** devolve tudo e não pede o descanso.
- Quem ficou sem comida ou bebida sofre a consequência escolhida nas configurações: nada, **descanso Agitado** (padrão: a Vigília vira Agitada; o Descanso Completo não reduz Exaustão) ou **+1 de Exaustão**. Aparece no cartão da refeição e no cartão do descanso.

Os jogadores não escrevem dados do mundo: a fogueira passa pelo socket do módulo e é o Mestre ativo quem mexe nos inventários e na pilha (configuração de mundo oculta `pilha`). Precisa de um Mestre conectado.

## Fome

Cada personagem guarda a hora da última refeição (flag `ultimaRefeicao`). Com o relógio do mundo andando (Monolith: Calendário), o Mestre ativo avisa no chat uma vez por nível: com o intervalo padrão de 8 horas, "está começando a ficar com fome" às 8 h, "está com fome" às 16 h e "está faminto" a partir de 24 h. Num salto grande de tempo sai só o nível alcançado. Quem come na fogueira antes de uma Vigília ou Descanso Completo com o relógio avançando conta como alimentado ao acordar.

- Comer: servir a fogueira, usar um consumível de comida pela ficha, o botão **Comer agora** do cartão (dono, gasta 1 de comida do inventário) ou **Já comeu** (Mestre, sem gastar).
- Configurações: ligar a fome, horas por nível, sussurrar ao dono e ao Mestre ou avisar em público, incluir NPCs (atores sem jogador com token ligado na cena ativa) e a regra opcional de **inanição** (desligada por padrão: depois de 3 + mod. de Constituição dias sem comer, mínimo 1, cada dia dá 1 de Exaustão).
- Na primeira vez (e ao religar a fome), todos contam como alimentados agora.

## Console

`game.modules.get("monolith-resting").api`: `abrirPedido()`, `pedirDescanso(atores, opções)`, `descansar(ator, "folego" | "vigilia" | "completo", opções)`, `acenderFogueira({ tipo, tipoNome, racoes, agua, comensais, pedido })`, `abrirFogueira()`, `servir()`, `pilha()`, `registrarRefeicao(ator, tempo?)`, `comerAgora(ator)`, `verificarFome()`.

O hook `monolithResting.restCompleted (actor, tipo, { sonoInteiro, agitada })` avisa outros módulos; o Monolith: Regras da Casa usa para limpar o Fio.

Desative o **Rest Recovery** ao usar este módulo.
