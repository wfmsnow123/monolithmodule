# SettingField

One row of a module's settings form: label left, control right, hint underneath — the shape of Foundry's `.form-group`.

## Anatomy

- `.mono-heading` — Bebas Neue section heading with a red block before it and a `void-300` rule after it.
- `.mono-field` — the row (a `<label>` or `<div>`); 1px `void-300` divider below.
- `.mono-field__label` — setting name, `body-strong`.
- Control: `.mono-input` (text/number), `.mono-select`, `.mono-check` (checkbox, fills `blood-500`), `.mono-toggle` (switch, fills `cobalt-500`; add `role="switch"`).
- `.mono-field__hint` — `hint` style in `ink-muted`; `--warn` turns it `ichor` for "requires reload".
- `.mono-field__key` — optional setting key in mono, for GM-facing debug.

## Rules

- Checkbox for a plain on/off rule; toggle for something that acts live (audio, visual effects).
- Errors: `aria-invalid="true"` on the control + a hint in `blood-text` saying what to fix.
- Inputs are carved: `void-200` fill, `void-400` border, `shadow-pit`.

## In Foundry

`game.settings.register` renders `.form-group > label + .form-fields + p.hint`. Map them with module CSS under your settings tab: `.form-group` → `.mono-field` rules, `p.hint` → `.mono-field__hint`. For `registerMenu` forms you render yourself, use these classes directly.
