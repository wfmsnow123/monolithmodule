# Monolith: Luzes (módulo do Foundry)

Foundry 13, dnd5e 5. Tochas, velas, lamparinas e lanternas são itens de verdade: o jogador acende o que carrega, e a luz vai junto com o token. Substitui o **Torch** (os dois brigam pela luz do token; o módulo oferece desligar o Torch ao abrir o mundo).

## Acender
- **HUD do token**: botão de chama na coluna da esquerda. Com uma fonte, alterna direto; com várias, abre a lista com o tempo que resta de cada uma. Botão direito cobre ou descobre a lanterna acesa.
- **Ficha**: usar a tocha ou a lanterna acende e apaga (ataques com a tocha continuam sendo ataques). Também no botão direito do item (ficha do dnd5e e Tidy) e no cabeçalho da ficha do item.

## Luz no token
A luz do token é a mais forte entre os itens acesos que o personagem carrega. Apagou tudo, o token volta à luz que tinha antes. O item saiu do inventário (soltou, trocou, vendeu), a luz sai junto. Com o **Item Piles**, uma tocha acesa largada no chão vira uma pilha iluminada. Lanterna furta-fogo é um cone na direção do token. Cenas em metros convertem os alcances sozinhas.

## Queima
Com o tempo do mundo (calendário, descansos, avanço de horas), a chama queima:
- **Tocha** e **vela**: 1 hora; ao acabar, gasta uma unidade. Apagar no meio guarda o que sobrou.
- **Lamparina** e **lanternas**: 6 horas por frasco de óleo; acender sem óleo carregado não funciona, e cada recarga gasta um frasco do inventário.
O dono recebe aviso quando faltam 10 minutos e quando se apaga.

## Fontes padrão (editáveis)
| Fonte | Plena / penumbra | Queima | Gasta |
| :--- | :--- | :--- | :--- |
| Tocha | 20 / 40 pés | 1 h | a tocha |
| Vela | 5 / 10 pés | 1 h | a vela |
| Lamparina | 15 / 45 pés | 6 h | óleo |
| Lanterna coberta | 30 / 60 pés (coberta: 0 / 5) | 6 h | óleo |
| Lanterna furta-fogo | 60 / 120 pés, cone de 57° | 6 h | óleo |

Em Configurações > Monolith: Luzes > **Editar fontes de luz**: nomes de item que contam, alcance, ângulo, cor, animação, queima, o que gasta e o modo coberto. Um item com nome diferente pode receber a fonte à mão em **Fonte de luz...** no cabeçalho da ficha dele (Mestre).

## API
`game.modules.get("monolith-luzes").api`: `acender(item)`, `apagar(item)`, `alternar(item)`, `alternarCobertura(item)`, `aceso(item)`, `fonteDe(item)`, `itensDeLuz(actor)`, `sincronizar(actor)`.
