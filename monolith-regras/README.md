# Monolith: Regras da Casa (módulo do Foundry)

Foundry 13, dnd5e 5.2 (regras legadas 2014). Compatível com Tidy 5e Sheets (Clássica e Quadrone).

## O que faz

**Painel de Inspiração.** Painel flutuante fora da ficha, arrastável e recolhível. Fica ancorado pela borda de baixo: a lista cresce para cima e não sai da tela. Os retratos são 3x4; imagens de outra proporção ganham um leve zoom para preencher.
- Jogadores veem só os próprios personagens (dono ou personagem atribuído), ou todos, conforme a configuração **Personagens no painel dos jogadores**. O Mestre vê todos.
- Estrela: Inspiração. Clique para gastar. Mestre: botão direito concede. Se o personagem já tinha Inspiração, ganha uma Inspiração Heróica no lugar.
- Dado: Inspiração Heróica, sem limite. Clique para gastar (+1d4 no chat). Mestre: botão direito soma uma.
- Mão: dá uma Inspiração Heróica a outro personagem, que a usa na hora.
- Retrato: abre as Medidas Desesperadas (com o **Monolith: Medidas Desesperadas** ativo). Nome: abre a ficha.
- Cabeçalho: rolar com Ênfase; pedir descanso (Mestre).

**Exaustão de 10 níveis.** -1 por nível em todos os testes de d20 e na CD de magia, aplicado no próprio efeito de exaustão do dnd5e. Efeitos de nível automáticos:
- 3: desvantagem em testes de habilidade;
- 4: deslocamento pela metade;
- 7: desvantagem em ataques e testes de resistência;
- 9: PV máximo pela metade;
- 10: morte.
Funciona no HUD do token, na ficha do dnd5e e nas duas fichas Tidy.

**Descansos.** Ficam no módulo **Monolith: Resting Rules**. O ícone de cama do painel abre o pedido de descanso dele.

**Medidas Desesperadas e Perdição.** Desde a 0.6 ficam nos módulos **Monolith: Medidas Desesperadas** (`monolith-medidas`) e **Monolith: Perdição** (`monolith-perdicao`). Ao abrir o mundo, eles migram sozinhos o Fio, as Medidas armadas, a Queima e a Perdição guardados por este módulo.

**Sobrecarga.** Usa a carga variante do dnd5e (limites e redução de deslocamento) e acrescenta a desvantagem em ataques, testes de habilidade e testes de resistência de Força, Destreza e Constituição quando o personagem está severamente sobrecarregado. Os multiplicadores podem ser trocados nas configurações (0 mantém o padrão do dnd5e: 5 e 10 x Força em libras, ou 2,5 e 5 x Força em quilos). Substitui o Variant Encumbrance + Midi. Se o **Monolith: Encumbrance** estiver ativo, esta parte se desliga e ele assume a carga.

**Ênfase.** Modificador de dado `ef`: `/r 2d20ef + 3`. A Medida Apostar arma a próxima rolagem de d20 do personagem com Ênfase (API: `game.modules.get("monolith-regras").api.armarEnfase(actor)`).

## Antes de usar
- Use o **Monolith: Resting Rules** no lugar do Rest Recovery. Se o Rest Recovery continuar ativo, desligue a opção **One D&D exhaustion** dele (o módulo pergunta ao abrir o mundo).
- Os contadores antigos do custom-dnd5e (Desgaste de Alma, Conta Diferida, Pontos de Corrupção) podem ser removidos.

## Limites conhecidos
- A Sobrecarga daqui é a antiga; prefira o **Monolith: Encumbrance**.
