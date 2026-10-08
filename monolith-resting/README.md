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

Console: `game.modules.get("monolith-resting").api` (`abrirPedido()`, `pedirDescanso(atores, opções)`, `descansar(ator, "folego" | "vigilia" | "completo", opções)`).

O hook `monolithResting.restCompleted (actor, tipo, { sonoInteiro, agitada })` avisa outros módulos; o Monolith: Regras da Casa usa para limpar o Fio.

Desative o **Rest Recovery** ao usar este módulo.
