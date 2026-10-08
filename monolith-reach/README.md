# Monolith: Reach

Jogadores só interagem com o mapa quando o token está ao alcance: por padrão 5 pés, em qualquer direção, incluindo diagonais (a área é o quadrado do token expandido pelo alcance). O Mestre nunca é bloqueado.

## O que é limitado

- **Portas**: abrir, fechar e trancar pelo ícone da porta.
- **Tiles do Monk's Active Tiles** acionados por clique (clique, duplo clique, botão direito). Gatilhos de entrar/sair do tile e os disparados pelo Mestre não mudam.
- **Interruptores do Light Switch**.

O alcance é medido a partir dos tokens selecionados pelo jogador; sem seleção, usa os tokens do personagem dele na cena. Sem token na cena, a interação é bloqueada (configurável).

## Configurações

Configurar Definições > Monolith: Reach: alcance, o que é limitado (portas, tiles, interruptores), permitir sem token e avisos.

## Tecla

**E** (editável em Controles): abre ou fecha a porta destrancada mais próxima ao alcance do token selecionado.

## Créditos

A tecla de interagir com a porta mais próxima foi inspirada no [Arms Reach](https://github.com/p4535992/foundryvtt-arms-reach) (p4535992, MIT). O código deste módulo é próprio. Os dois limitam portas; não ative os dois juntos.
