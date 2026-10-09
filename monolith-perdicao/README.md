# Monolith: Perdição (módulo do Foundry)

Foundry 13, dnd5e 5.2. Feito para a ficha Tidy 5e Clássica, funciona em qualquer ficha.

## O que faz

**A trilha.** Perdição de 0 a 20 com os estados do Guia do Jogador: Firme, Abalado, Esgarçado, À Beira e Perdido.

**Contador na ficha.** Na Tidy Clássica, ao lado do nível e junto do botão das Medidas Desesperadas: olho fechado e o valor, em azul, esquentando com o estado. Clique para abrir a janela. Nas outras fichas (e na Tidy nova), o botão fica no cabeçalho.

**Limiares e Marcas.** Ao subir por 5, 10 ou 15, cria uma Marca de Loucura, ou de Danação se o personagem estiver Ligado a um corruptor, para o Mestre definir o efeito persistente e o agudo. O piso (5 x Marcas) é respeitado em toda redução, e uma Marca nova puxa a Perdição até o piso.

**Testes.**
- Teste de resistência de Perdição: CD, tamanho do horror e fonte. Usa a salvaguarda de Lucidez. Na falha, rola e soma o ganho (1, 1d4 ou 1d8). Com 1 natural o ganho dobra e vem a Loucura Transitória; com 20 natural, −1 e imunidade à fonte.
- A partir de 10 (Esgarçado), toda salvaguarda de Lucidez é rolada com Ênfase, de qualquer lugar.
- Firmar-se: CD 10 + Marcas.

**Mestre.** ±1, ganhos por horror, recuperações (Ato de Heroísmo, com preço pessoal, refúgio), Marcas (criar, editar, remover) e Ligação a um corruptor.

## Configurações
- Jogadores veem a própria Perdição. Desligado, o contador some para eles e os avisos vão sussurrados ao Mestre.
- Chave da Lucidez (padrão `san`, a do custom-dnd5e).
- Criar Marca ao cruzar um limiar.
- Contador na ficha Tidy (por usuário).

## Migração
Ao abrir o mundo, o Mestre migra uma vez a Perdição guardada pelo **Monolith: Regras da Casa** até a 0.5.

## API
`game.modules.get("monolith-perdicao").api`: `valor`, `piso`, `estado`, `marcas`, `ligacao`, `ajustar(actor, delta, {motivo})`, `definir`, `rolarGanho(actor, formula, motivo)`, `testar(actor, {cd, horror, fonte})`, `firmarSe`, `adicionarMarca`, `removerMarca`, `abrir(actor)`. Hook `monolithPerdicao.changed(actor, {antigo, novo, motivo, novas})`.
