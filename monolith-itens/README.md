# Monolith: Itens & Miscelânea (módulo do Foundry)

Foundry 13, dnd5e 5. Itens de Monolith prontos para a mesa, em português, com preço e peso, e cardápios de Polésia para mostrar aos jogadores.

## Importar
Na primeira vez que o Mestre abre o mundo, a janela de importação aparece sozinha. Depois fica em Configurações > Monolith: Itens & Miscelânea > **Importar para o mundo**.
- Itens vão para a pasta **Monolith: Itens** da aba Itens, em subpastas.
- Cardápios vão para a pasta **Monolith: Cardápios** do Jornal, separados por Valenda, Solmere, Interior e estradas, Festas da estação.
- Pode rodar de novo: o que já foi importado é atualizado no lugar, sem duplicar. Itens que você moveu de pasta ficam onde estão.

## O que vem
| Pasta | Itens |
| :--- | :--- |
| Comida / Pratos de taverna | os 12 pratos do cardápio de Artênis do livro (Mingau, Funges, Salomene, Mawmeny, Rique-manger, Cinnamon brennet...) |
| Comida / Sobremesas | as 8 sobremesas do livro |
| Comida / Petiscos de taverna | os petiscos com nome de monstro do livro, e o Néctar de fada |
| Comida / De Polésia | vinho e queijo Belblossom, queijo de Varenholdt, pães do Moinho do Sern, doces da Bennett, salmão de Foz Clara, peixe salgado de Elendor, pão de Zekes |
| Comida / Mercado, Frutas e castanhas, Legumes e raízes, Viagem | o que se compra na feira no outono polesiano, e rações |
| Bebidas | as bebidas do livro, em caneca e em garrafa (a Ale kretaniana ficou de fora) |
| Ingredientes | sal, especiarias, açafrão, farinhas, mel, lúpulo |
| Roupas / Corpo e Acessórios | roupas de Polésia; as de corpo têm CA |
| Armaduras | as armaduras e escudos do dnd5e, em português, mais o Peitoral cerimonial polesiano |

**Preços**: os do livro (Valores & Moedas). Mon, Lysar, Cithin, Aurel e Telun são pc, pp, pe, po e pl do dnd5e. Das faixas do livro ficou o valor de taberna simples; os cardápios de cidade usam o de cidade.

**Comida e bebida**: consumíveis com a ação Comer ou Beber, que gasta uma porção (garrafas e peças grandes têm várias). Vêm marcadas como comida ou bebida para a Fogueira do Monolith: Resting. Pela regra do livro, comida melhor que ração reduz em 2 a CD do Acampamento Exposto.

**Roupas** (regra da mesa, o livro não traz): a peça de corpo conta como armadura leve, CA 8 (pano fino, roupa de dormir, trapos) ou CA 10 (roupa inteira), mais Destreza, e todo mundo é proficiente. Botas, chapéus, luvas e capas não mexem na CA.

**Ícones**: os do próprio Foundry.

## Cardápios
20 cardápios no tema Pergaminho do Monolith: Journals: Taverna do Hanson, Confeitaria Bennett, Padaria Grãos do Centeio, Vinícola Belblossom e Açougue do Pierce (Valenda); Mercado de Altobaixo, Casa de pasto da Arcada, Estalagem da Estação, Casa de chá do Pináculo e Taverna dos Lampareiros (Solmere); Lexford, Daenish, Caezar, Foz Clara, Elendor, a estrada e uma barraca de feira; e as festas de outono (Banquete de Zekes, Feira do Fim do Ciclo, Dia do Cervejeiro e do Cozinheiro).

## Gerar os dados
Os itens e cardápios ficam em `data/`, gerados por `python fonte/gerar_itens.py` e `python fonte/gerar_cardapios.py`.
