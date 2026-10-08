# Módulos de Monolith para Foundry VTT

Dois módulos para a mesa de Monolith (Foundry 13, dnd5e 5.2).

| Módulo | O que faz | Manifest (cole em Instalar Módulo) |
| :--- | :--- | :--- |
| **Monolith: Regras da Casa** (`monolith-regras`) | Exaustão de 10 níveis, Inspiração Heróica, Medidas Desesperadas, Queima de Alma, Ênfase. Compatível com Tidy 5e. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-regras/module.json` |
| **Monolith: Calendário** (`monolith-calendario`) | Fork do [Calendaria](https://github.com/Sayshal/Calendaria) (Tyler/Sayshal, MIT) com luas e estações fiéis ao Fantasy-Calendar.com e sincronização com o site. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-calendario/module.json` |
| **Monolith: Encumbrance** (`monolith-encumbrance`) | Carga configurável: faixas por Força, deslocamento, desvantagens por habilidade e efeitos livres. Substitui o Variant Encumbrance. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-encumbrance/module.json` |
| **Monolith: Reach** (`monolith-reach`) | Portas, tiles do Monk's Active Tiles e interruptores do Light Switch só ao alcance do token (5 pés). | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-reach/module.json` |
| **Monolith: Resting Rules** (`monolith-resting`) | Fôlego, Vigília e Descanso Completo prontos no dnd5e, com limites por dia, acampamento Exposto e Dormir é para os Fracos. Substitui o Rest Recovery. | `https://raw.githubusercontent.com/wfmsnow123/monolithmodule/main/monolith-resting/module.json` |

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
