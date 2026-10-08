# Monolith

Grimdark e terror para os módulos de Foundry VTT do mundo Monolith. Este sistema define a cara de toda janela, aba de configurações e diálogo dos módulos: pedra negra, sangue e um azul frio de cobalto.

## Princípios

1. **Pedra, não vidro.** Cantos retos (`radius-none` em janelas e abas, no máximo `radius-sm` em controles), sem gradientes, sem brilho. Campos parecem entalhados (`shadow-pit`).
2. **O vermelho é compromisso.** `blood-500` marca a ação que muda o mundo: Salvar, Confirmar, Apagar. Uma por janela. Se tudo é vermelho, nada assusta.
3. **O azul é orientação.** `cobalt-500` diz onde você está e o que está ligado: aba ativa, toggles, avisos informativos.
4. **O preto é o palco.** Superfícies `void-*` ocupam quase toda a tela; as cores aparecem em doses pequenas, como um ferimento.
5. **Silêncio na interface, horror no conteúdo.** A UI é sóbria e legível; o terror vem dos textos, nomes e imagens do mundo, não de fontes ilegíveis.

## Cores

Dois temas: **Abyss** (escuro, o padrão, acompanha o tema escuro do Foundry) e **Ossuary** (claro, osso envelhecido).

| Papel | Token | Uso |
| --- | --- | --- |
| Fundo | `void-000` → `void-100` → `void-200` | backdrop → corpo da janela → campos e áreas elevadas |
| Linhas | `void-300` (divisórias), `void-400` (bordas de controle, 3:1) | |
| Texto | `ink`, `ink-muted`; `bone` sobre vermelho/azul | |
| Sangue | `blood-500` / `blood-600` preenchimento, `blood-text` texto, `blood-wash` fundo de alerta | ação primária, erro, destrutivo |
| Cobalto | `cobalt-500` / `cobalt-600`, `cobalt-text`, `cobalt-wash` | seleção, info, links |
| Foco | `ward` | contorno 2px em todo controle focado |
| Sinais | `ichor` (aviso), `verdigris` (sucesso) | só para estado, em pouca quantidade |

Todo texto tem contraste 4.5:1 no seu fundo indicado, nos dois temas. Exceção conhecida: `ichor` no tema claro só passa em `void-000`/`void-100` — não use sobre `void-200`.

## Tipografia

- **Bebas Neue** (`--font-display`) — títulos de janela, seções e splash. Só tem maiúsculas e um peso (400): o impacto vem do tamanho, nunca de negrito. Condensada e vertical, como uma lápide.
- **Barlow** (`--font-sans`) — todo texto de interface, 14/20.
- **Barlow Condensed** (`--font-label`) — botões, abas, badges, cabeçalhos de coluna; caixa alta com espaçamento 0.12em.
- **JetBrains Mono** (`--font-mono`) — chaves de configuração, macros.

Todas vêm do Google Fonts (o `bundle.css` já faz o `@import`). Para jogar offline, baixe os arquivos e declare `@font-face` no CSS do módulo.

## Espaço e forma

Grade de 4px: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-6` 24 · `space-8` 32. Janelas têm `space-4` de padding; linhas de configuração `space-3` na vertical; seções separadas por `space-6`.

## Voz

- Rótulos em português, curtos e diretos: "Limite de Sanidade", não "Configure aqui o limite de sanidade".
- Dicas dizem a consequência: "Abaixo disso, o personagem rola na tabela de Loucura."
- O tom pode ser sombrio nos nomes (Abissal, Ordem do Olho Fechado), nunca nos avisos de erro: erros dizem o que corrigir.

## Iconografia

Sem pacote de ícones próprio por enquanto. Use os ícones Font Awesome do Foundry em `ink-muted`, 14px, e o **sigilo** do sistema: um bloco retangular vermelho (`blood-500`, 4–8px de largura) antes de títulos, ou um losango para avisos.

## Componentes

Classes CSS puras com prefixo `mono-` (em `components/bundle.css`), sem JavaScript: Button, Window, SettingField (inclui título de seção, input, select, checkbox e toggle), Tabs, Notice, Badge.

## Usando nos módulos do Foundry

1. Copie `tokens.css` (gerado por este sistema) e `components/bundle.css` para `styles/` do módulo e liste os dois em `module.json` → `"styles"`.
2. Adicione a classe `mono` ao elemento raiz das suas aplicações (`classes: ["mono"]` em `DEFAULT_OPTIONS` da ApplicationV2).
3. Para o tema: aplique `data-theme="abyss"` ou `data-theme="ossuary"` no raiz, ou siga o tema do Foundry com `body.theme-light .mono { … }` mapeando para os valores Ossuary.
4. Nas configurações nativas (`game.settings.register`), estilize sob a aba do módulo: `.form-group` como `.mono-field`, `p.hint` como `.mono-field__hint`.
5. Prefixe as variáveis se outro módulo usar os mesmos nomes (ex.: `--monolith-blood-500`).
