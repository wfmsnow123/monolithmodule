# Módulos de Monolith para Foundry VTT

Módulos para a mesa de Monolith (Foundry 13, dnd5e 5.2).

| Módulo | O que faz | Manifest (cole em Instalar Módulo) |
| :--- | :--- | :--- |
| **Monolith: Regras da Casa** (`monolith-regras`) | Exaustão de 10 níveis, Inspiração e Inspiração Heróica, Ênfase, e os recursos incorporados: Lembretes, Percepção, Visão, Montaria, Barra de Chefe, Inventário, Troca e Retratos. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-regras/module.json` |
| **Monolith: Medidas Desesperadas** (`monolith-medidas`) | O Fio, Medidas configuráveis (custo, texto, efeito), Queimar a Alma, Recusar a Morte, O Nome que Fica. Coração no retrato da ficha Tidy Clássica. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-medidas/module.json` |
| **Monolith: Perdição** (`monolith-perdicao`) | Trilha de 0 a 20, Marcas e piso, Ligação a corruptores, testes de Perdição com Ênfase, Firmar-se. Contador no cabeçalho da ficha Tidy Clássica. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-perdicao/module.json` |
| **Monolith: Journals** (`monolith-journals`) | Temas de jornal (documento, carta, diário, gazeta, dossiê, pergaminho, tomo, manual, conto, card de NPC), escolhidos por botão sem mexer no HTML. Substitui o Monolith RPG. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-journals/module.json` |
| **Monolith: Itemizador** (`monolith-itemizador`) | Jornal vira item de Documento: arraste para a ficha, o jogador carrega e lê com o tema do jornal, sincronizado. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-itemizador/module.json` |
| **Monolith: Luzes** (`monolith-luzes`) | Tochas e lanternas como itens: o jogador acende e a luz vai com o token; queima com o tempo, gasta óleo, lanterna coberta, tocha no chão continua acesa. Substitui o Torch. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-luzes/module.json` |
| **Monolith: Calendário** (`monolith-calendario`) | Fork do [Calendaria](https://github.com/Sayshal/Calendaria) (Tyler/Sayshal, MIT) com luas e estações fiéis ao Fantasy-Calendar.com e sincronização com o site. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-calendario/module.json` |
| **Monolith: Encumbrance** (`monolith-encumbrance`) | Carga configurável: faixas por Força, deslocamento, desvantagens por habilidade e efeitos livres. Substitui o Variant Encumbrance. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-encumbrance/module.json` |
| **Monolith: Reach** (`monolith-reach`) | Portas, tiles do Monk's Active Tiles e interruptores do Light Switch só ao alcance do token (5 pés). | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-reach/module.json` |
| **Monolith: Resting Rules** (`monolith-resting`) | Fôlego, Vigília e Descanso Completo prontos no dnd5e, com limites por dia, acampamento Exposto e Dormir é para os Fracos. Substitui o Rest Recovery. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-resting/module.json` |
| **Monolith: QoL Mods** (`monolith-qol`) | Autocompletar propriedades, Escopo das configurações, Visão do Mestre e Rolagens do Mestre, cada um com liga/desliga e janela de opções. Substitui Autocomplete Inline Properties, DF Settings Clarity, GM Vision e Hide GM Rolls. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-qol/module.json` |
| **Monolith: Itens & Miscelânea** (`monolith-itens`) | Comidas e pratos do livro, comidas e bebidas de Polésia, roupas com CA e armaduras do dnd5e, importados em pastas, e 20 cardápios no Jornal. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-itens/module.json` |

O Monolith: Calendário substitui o Calendaria; não ative os dois juntos. Créditos e notas para os autores originais em [monolith-calendario/README-MONOLITH.md](monolith-calendario/README-MONOLITH.md).

## Publicar uma versão

1. Suba a `version` no `module.json` do módulo e ajuste o `download` para a tag nova:
   `https://github.com/wfmsnow123/monolithmodule/releases/download/<módulo>-v<versão>/<módulo>.zip`
2. Commit e push na `main`.
3. Crie e envie a tag `<módulo>-v<versão>` (ex.: `monolith-regras-v0.1.1`).
4. O GitHub Actions compila (o calendário também roda os testes), cria a release com o zip e o `module.json`, e o Foundry passa a oferecer a atualização.

## Desenvolvimento do calendário

```
cd monolith-calendario
npm ci --ignore-scripts
npm test
npm run build      # gera dist/
```
