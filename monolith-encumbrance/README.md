# Monolith: Encumbrance

Carga configurável para dnd5e 5.2 (Foundry 13). Substitui o Variant Encumbrance + Midi.

## Como funciona

- O peso carregado vem do próprio dnd5e (itens, moedas, contêineres), com multiplicadores opcionais para itens equipados e não equipados.
- Cada **faixa** tem um limite em vezes a Força (ampliado pelo tamanho e por Constituição Poderosa, se ligado). A faixa aplicada é a de maior limite que o peso ultrapassa.
- A faixa vira um **efeito ativo** no personagem, atualizado sozinho quando itens, moedas, Força ou tamanho mudam.
- Ao abrir o mundo, o módulo oferece desligar a regra de carga do próprio dnd5e, para a redução de deslocamento não contar em dobro. O peso continua sendo calculado.

## Editar as faixas

Configurar Definições > Monolith: Encumbrance > **Editar faixas de carga**. Para cada faixa:

- **Acima de N x Força**: o limite. A unidade (libras do livro ou quilos) é escolhida nas configurações; com pesos em quilos no mundo, 5 x Força em libras vira 2,5 kg por ponto.
- **Deslocamento**: sem mudança, reduzir em, multiplicar por ou definir em (na unidade de distância do mundo).
- **Desvantagem**: grade por habilidade (FOR, DES, CON, INT, SAB, CAR) e tipo de rolagem (ataques, testes, resistências). Testes incluem perícias.
- **Efeitos extras**: mudanças livres de efeito ativo, uma por linha, no formato `chave | modo | valor`. Exemplos:
  ```
  system.attributes.ac.bonus | add | -1
  system.bonuses.abilities.skill | add | -2
  system.attributes.init.bonus | add | -2
  ```
  Modos: add, multiply, override, upgrade, downgrade.
- **Ícone** e **descrição** do efeito.

**Restaurar regra de Monolith** volta às faixas do livro: Sobrecarregado (5 x Força, -10 pés) e Severamente Sobrecarregado (10 x Força, -20 pés e desvantagem em FOR, DES e CON), mais uma faixa opcional desligada de "Acima da Capacidade".

Console: `game.modules.get("monolith-encumbrance").api` (`faixaAtual(actor)`, `pesoCarregado(actor)`, `limite(actor, faixa)`, `recalcularTodos()`, `abrirEditor()`).

Com este módulo ativo, a Sobrecarga do Monolith: Regras da Casa se desliga sozinha.
