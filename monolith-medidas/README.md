# Monolith: Medidas Desesperadas (módulo do Foundry)

Foundry 13, dnd5e 5.2. Feito para a ficha Tidy 5e Clássica, funciona em qualquer ficha.

## O que faz

**O Fio.** As três caixas de falha da salvaguarda contra a morte. Falhas marcadas (✖) vêm das Medidas e só o descanso apaga: uma por Vigília, duas com sono inteiro, todas no Descanso Completo (com o **Monolith: Resting Rules**). Cair a 0 PV com falhas marcadas já começa com elas preenchidas; três marcadas é morte.

**Coração na ficha.** Na Tidy Clássica, um coração em cima do retrato abre as Medidas. Ele mostra o estado: apagado até Sangrar, vermelho pulsando quando Sangrando ou Morrendo, âmbar queimando, caveira morto, e três pontos com o Fio. Nas outras fichas (e na Tidy nova), o botão fica no cabeçalho.

**Janela de Medidas.** Retrato, PV, estado, Fio, Medidas agrupadas por custo, Medidas armadas, os botões de morte e as ferramentas do Mestre. Tem tamanho fixo e rola.

**Medidas configuráveis.** Em Configurações > Monolith: Medidas Desesperadas > **Editar Medidas**, cada Medida tem nome, custo (1 a 3 falhas), texto, se fica armada e o que acontece ao usar:
- Só anunciar;
- Armar Ênfase (precisa do **Monolith: Regras da Casa**);
- Rolar fórmula (ex.: `1d8`);
- Recuperar espaço de magia (até o círculo do parâmetro);
- Executar macro (UUID ou nome; a macro recebe `actor`, `token` e `medida`).
O botão **Restaurar as do livro** volta às dez Medidas do Guia do Jogador.

**Morte.** Queimar a Alma, Recusar a Morte, Morrendo, ainda (Inspiração Heróica para um aliado) e O Nome que Fica. Queimando: não rola salvaguardas, dano soma uma falha, e o início de cada turno soma Perdição (com o **Monolith: Perdição**).

## Configurações
- Só enquanto Sangrando (padrão: ligado).
- Uma Medida por turno: perguntar, bloquear ou sem limite.
- Coração na ficha Tidy (por usuário).

## Migração
Ao abrir o mundo, o Mestre migra uma vez os dados guardados pelo **Monolith: Regras da Casa** até a 0.5 (falhas marcadas, Medidas armadas, Queima, Recusar a Morte).

## API
`game.modules.get("monolith-medidas").api`: `abrir(actor)`, `abrirEditor()`, `estado(actor)`, `usar(actor, id)`, `lista()`, `queimarAlma(actor)`, `encerrarQueima(actor)`. Hook `monolithMedidas.usada(actor, medida)`.
