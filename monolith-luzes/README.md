# Monolith: Luzes (módulo do Foundry)

Foundry 13, dnd5e 5. Tochas, velas, lamparinas, lanternas e magias de luz são coisas de verdade: o jogador acende o que carrega, e a luz vai junto com o token. Uma tocha pode ser largada no mapa e continua acesa. Substitui o **Torch** (os dois brigam pela luz do token; o módulo traz as configurações do Torch e oferece desligá-lo ao abrir o mundo).

## Acender
- **HUD do token**: botão de chama na coluna da esquerda. Com uma fonte, alterna direto; com várias, abre a lista com o tempo que resta de cada uma (o que está no inventário, o que o token leva junto e o que está no chão a um quadrado). Botão direito cobre ou descobre a lanterna acesa.
- **Ficha**: usar a tocha ou a lanterna acende e apaga (ataques com a tocha continuam sendo ataques). Também no botão direito do item (ficha do dnd5e e Tidy) e no cabeçalho da ficha do item.
- **Magias**: Luz, Globos de Luz, Criar Chamas e Luz do Dia. Lançar a magia acende; apagar pelo HUD ou pela ficha. Não gastam nada e acabam com a duração da magia.
- **Sem item**: o Mestre (ou todos, conforme a configuração) acende um token que não tem nenhuma fonte com a luz avulsa (padrão: Tocha, 20/40 pés).

## Luz no token
A luz do token é a mais forte entre os itens acesos que o personagem carrega, os objetos que ele leva junto e a luz avulsa. Apagou tudo, o token volta à luz que tinha antes. O item saiu do inventário (soltou, trocou, vendeu), a luz sai junto. Lanterna furta-fogo é um cone na direção do token. Cenas em metros convertem os alcances sozinhas.

## Luz no mapa
- **Largar**: arraste uma tocha, vela ou lanterna da ficha para um lugar vazio do mapa. Uma unidade sai do inventário e fica ali como um ícone pequeno, do jeito que estava (acesa ou não, com o tempo que sobrou, coberta ou não). Acesa, ilumina em volta.
- **Mexer**: clique no ícone com o seu token a até um quadrado (borda a borda, diagonal vale). Abre uma paleta: **Acender/Apagar**, **Cobrir**, **Pegar** (volta para o inventário de quem pegou, com tudo) e **Carregar junto** (o objeto vai com o token: um ícone no canto do token e a luz andando com ele, sem atraso). Para soltar de novo, **Largar aqui** na lista do HUD. O Mestre faz tudo de qualquer lugar, com o token selecionado.
- O que está no chão ou levado junto também queima com o tempo; uma tocha que acaba some do mapa.
- Jogadores não criam objetos no mapa: o pedido vai para o Mestre. Sem Mestre online, nada acontece (aparece um aviso).
- **Item Piles**: soltar em cima de um token (uma pilha, outro personagem) segue como sempre. Segure **Shift** ao soltar para o Item Piles criar uma pilha em vez do objeto de luz. Dá para desligar o arrastar nas configurações.
- O Mestre ajeita o objeto na camada de Tiles (mover, girar a lanterna furta-fogo, apagar); a luz acompanha.

## Queima
Com o tempo do mundo (calendário, descansos, avanço de horas), a chama queima:
- **Tocha** e **vela**: 1 hora; ao acabar, gasta uma unidade. Apagar no meio guarda o que sobrou.
- **Lamparina** e **lanternas**: 6 horas por frasco de óleo; acender sem óleo carregado não funciona, e cada recarga gasta um frasco do inventário (o Mestre enche de graça, a não ser que a configuração diga o contrário).
- **Magias**: a duração delas (Luz 1 h, Globos de Luz 1 min, Criar Chamas 10 min, Luz do Dia 1 h).
O dono recebe aviso quando faltam 10 minutos e quando se apaga.

## Fontes padrão (editáveis)
| Fonte | Conta para | Plena / penumbra | Queima | Gasta |
| :--- | :--- | :--- | :--- | :--- |
| Tocha | objeto | 20 / 40 pés | 1 h | a tocha |
| Vela | objeto | 5 / 10 pés | 1 h | a vela |
| Lamparina | objeto | 15 / 45 pés | 6 h | óleo |
| Lanterna coberta | objeto | 30 / 60 pés (coberta: 0 / 5) | 6 h | óleo |
| Lanterna furta-fogo | objeto | 60 / 120 pés, cone de 57° | 6 h | óleo |
| Luz | magia | 20 / 40 pés | 1 h | nada |
| Globos de Luz | magia | 0 / 10 pés | 1 min | nada |
| Criar Chamas | magia | 10 / 20 pés | 10 min | nada |
| Luz do Dia | magia | 60 / 120 pés | 1 h | nada |

Em Configurações > Monolith: Luzes > **Editar fontes de luz**: nomes que contam, tipo (objeto, magia ou qualquer), alcance, ângulo, cor, animação, queima, o que gasta e o modo coberto. **Importar do Torch** lê o JSON de fontes extras do Torch. Um item com nome diferente pode receber a fonte à mão em **Fonte de luz...** no cabeçalho da ficha dele (Mestre).

## Configurações
Jogadores acendem as próprias luzes; só acende o que está equipado; quem gasta combustível ao acender (jogador, Mestre); quem pode usar a luz sem item e o alcance dela; arrastar luz para o mapa.

## Vindo do Torch
Na primeira abertura com o Mestre, o módulo lê as configurações que o Torch deixou no mundo (mesmo desligado) e traz: tochas dos jogadores, consumo do jogador e do Mestre, luz sem item (fallback) e o nome e alcance dela. Se o Torch tinha fontes extras (gameLightSources), pergunta se quer trazê-las. "Dancing lights vision" não tem equivalente (os Globos de Luz são luz no token).

## API
`game.modules.get("monolith-luzes").api`: `acender(item)`, `apagar(item)`, `alternar(item)`, `alternarCobertura(item)`, `aceso(item)`, `fonteDe(item)`, `itensDeLuz(actor)`, `luzDoToken(tokenDoc)`, `sincronizar(actor)`, `importarTorch(json)`, `pedir(acao, dados)`.

Partes da lista de fontes vêm do Torch (Beerware): veja `LICENSE-TORCH.txt`.
