# Button

Square-cut, uppercase action button in the label face; one blood-red primary per window.

## Variants

| class | when |
| --- | --- |
| `mono-btn mono-btn--primary` | The one committing action of a window (Salvar, Confirmar). Fill `blood-500`, text `bone`. |
| `mono-btn mono-btn--secondary` | A strong but non-destructive action (Importar, Abrir Configuração). Fill `cobalt-500`. |
| `mono-btn` | Everything else (Cancelar, Fechar). Fill `void-200`, border `void-400`. |
| `mono-btn mono-btn--ghost` | Destructive-but-rare text actions (Restaurar padrões, Apagar). Text `blood-text`. |

## Rules

- Max one `--primary` per window footer; put it last (rightmost).
- Labels are verbs, 1–2 words. The CSS uppercases them, write them in sentence case.
- Use the native `disabled` attribute; never fake it with color.
- Height 32px, padding `space-2` × `space-4`, radius `radius-sm`.
