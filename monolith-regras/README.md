# Monolith: Regras da Casa (módulo do Foundry)

Foundry 13, dnd5e 5.2 (regras legadas 2014). Compatível com Tidy 5e Sheets (Clássica e Quadrone) e Rest Recovery for 5E.

## O que faz

**Painel de Inspiração.** Painel flutuante fora da ficha, arrastável e recolhível.
- Estrela: Inspiração. Clique para gastar. Mestre: botão direito concede. Se o personagem já tinha Inspiração, ganha uma Inspiração Heróica no lugar.
- Dado: Inspiração Heróica, sem limite. Clique para gastar (+1d4 no chat). Mestre: botão direito soma uma.
- Mão: dá uma Inspiração Heróica a outro personagem, que a usa na hora.
- Retrato: abre as Medidas Desesperadas. Nome: abre a ficha.
- Cabeçalho: rolar com Ênfase; pedir descanso (Mestre).

**Exaustão de 10 níveis.** -1 por nível em todos os testes de d20 e na CD de magia, aplicado no próprio efeito de exaustão do dnd5e. Efeitos de nível automáticos:
- 3: desvantagem em testes de habilidade;
- 4: deslocamento pela metade;
- 7: desvantagem em ataques e testes de resistência;
- 9: PV máximo pela metade;
- 10: morte.
Funciona no HUD do token, na ficha do dnd5e e nas duas fichas Tidy.

**Descansos.** O Mestre pede o descanso pelo painel (ícone de cama): Fôlego, Vigília (com ou sem sono inteiro, ou Agitada) ou Descanso Completo. Cada jogador recebe o pedido e o diálogo do Rest Recovery abre normalmente; o módulo ajusta as regras do Rest Recovery só durante aquele descanso:
- Fôlego: características de descanso curto, 1 espaço de pacto, Dado de Vida gratuito.
- Vigília: características e espaços, sem PV, metade dos Dados de Vida, apaga 1 falha marcada (2 com sono inteiro); sono inteiro também tira 1 de Exaustão e dá o Dado de Vida gratuito. Agitada: metade das características e espaços, nada acima do 3º círculo.
- Completo: tudo, -2 de Exaustão, apaga todas as falhas marcadas.

**Medidas Desesperadas.** Janela por personagem, aberta pelo botão no cabeçalho da ficha (dnd5e ou Tidy) ou pelo retrato no painel. Mostra o Fio (✖ marcada, ● comum), as Medidas disponíveis quando Sangrando, as Medidas armadas, a Queima de Alma, Recusar a Morte, a Inspiração Heróica de quem está morrendo e O Nome que Fica.
- Cair a 0 PV com falhas marcadas preenche o Fio; três marcadas é morte.
- Queimando: não rola salvaguardas; dano aplicado soma uma falha (botão para crítico); início do turno soma Perdição.

**Sobrecarga.** Usa a carga variante do dnd5e (limites e redução de deslocamento) e acrescenta a desvantagem em ataques, testes de habilidade e testes de resistência de Força, Destreza e Constituição quando o personagem está severamente sobrecarregado. Os multiplicadores podem ser trocados nas configurações (0 mantém o padrão do dnd5e: 5 e 10 x Força em libras, ou 2,5 e 5 x Força em quilos). Substitui o Variant Encumbrance + Midi. Se o **Monolith: Encumbrance** estiver ativo, esta parte se desliga e ele assume a carga.

**Ênfase.** Modificador de dado `ef`: `/r 2d20ef + 3`. Apostar e o botão do Mestre armam a próxima rolagem de d20 do personagem com Ênfase.

## Antes de usar
- Desligue a opção **One D&D exhaustion** do Rest Recovery. O módulo pergunta isso ao Mestre ao abrir o mundo.
- Os contadores antigos do custom-dnd5e (Desgaste de Alma, Conta Diferida, Pontos de Corrupção) podem ser removidos.
- A Perdição fica numa marca do módulo, visível no painel de Medidas (configurável).

## Limites conhecidos
- Teimosia, Insistir e Golpe Selvagem só registram no chat; o efeito na rolagem é aplicado à mão.
- O Fôlego não conta o limite de dois por dia.
- Sem o Rest Recovery, o Descanso Completo recupera só metade dos Dados de Vida (regra padrão do dnd5e).
