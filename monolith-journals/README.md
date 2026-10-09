# Monolith: Journals (módulo do Foundry)

Foundry 13. Temas visuais para páginas de jornal de Monolith. Substitui o antigo módulo **Monolith RPG** (`monolith-rpg`): os temas dele continuam aqui, com os mesmos nomes de classe. Não ative os dois juntos.

## Dois jeitos de usar

**1. Pelo botão, sem mexer no HTML.** Abra o jornal e clique em **Tema do jornal** no cabeçalho (ou botão direito no jornal, na barra lateral). Escolha o tema, as variantes, e se vale para o jornal inteiro ou só para a página aberta. O texto continua o mesmo que você escreve no editor; o módulo só põe as classes na hora de mostrar. É o caminho para dar cara aos jornais que já existem.

**2. À mão.** No modo `</>` do editor, envolva o conteúdo uma vez:

```html
<div class="mj mj-carta mj-selada">
  ...conteúdo normal do editor...
</div>
```

## Temas

| Tema | Classe | Variantes | Para quê |
| :--- | :--- | :--- | :--- |
| Documento | `mj-documento` (ou `mono-doc`) | `mj-elendor`, `mj-luto` | ofícios, leis, cartilhas |
| Carta | `mj-carta` | `mj-selada`, `mj-rasgada` | correspondência |
| Diário | `mj-diario` | `mj-manchado` | caderno pessoal, letra à mão |
| Gazeta | `mj-gazeta` | `mj-colunas`, `mj-velha` | jornal impresso (o primeiro h1 é o cabeçalho, o parágrafo seguinte é a linha de data) |
| Dossiê | `mj-dossie` | `mj-sigiloso` | relatórios, inquéritos |
| Pergaminho | `mj-pergaminho` | `mj-real` | éditos, profecias |
| Tomo | `mj-tomo` | `mj-proibido`, `mj-codice` | livros antigos e proibidos |
| Manual | `mj-manual` (ou `monolith`) | `mj-ossario` | regras, no visual do design system |
| Conto | `mj-conto` (ou `mono-lore`) | humor: `verde` `sangue` `gelo` `aureo` `umbral` `abissal` `cinza`; efeito: `fx-embers` `fx-mist` `fx-snow` `fx-motes` | contos com banner |
| Card de NPC | `mono-npc` (ou `mj-npc`) | | exige a estrutura do card (`mn-main`, `mn-side`); só à mão |

A página **Regras Homebrew** já usa `<div class="monolith">` e ganha o tema Manual sozinha.

## Peças avulsas (em qualquer tema)

| Classe | Efeito |
| :--- | :--- |
| `<span class="mj-tarja">nome</span>` | tarja preta de censura |
| `<span class="mj-carimbo">Arquivado</span>` | carimbo inclinado |
| `<p class="mj-assinatura">Fulano</p>` | assinatura cursiva à direita |
| `<p class="mj-nota">...</p>` | anotação à mão na margem |
| `<span class="mj-selo"></span>` | selo de cera |
| `<p class="mj-capitular">...</p>` | letra capitular |
| `<span class="mj-data">...</span>` | data em itálico |
| `<figure class="mj-foto"><img ...></figure>` | foto colada, inclinada |

## Prévia

Abra `preview.html` no navegador para ver todos os temas sem o Foundry.

## API

`game.modules.get("monolith-journals").api`: `TEMAS`, `temaDe(page)`, `classesDe(cfg)`, `abrirSeletor(journal, pageId)`. O tema fica em `flags.monolith-journals.tema` do jornal ou da página: `{ tema, classes, semTitulo }`.
