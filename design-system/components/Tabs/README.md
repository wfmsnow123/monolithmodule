# Tabs

Uppercase label tabs that split a settings window into sections; the selected tab is marked in cobalt.

## Anatomy

- `.mono-tabs` with `role="tablist"`; a `void-300` baseline.
- `.mono-tab` with `role="tab"`; `aria-selected="true"` gives `cobalt-text` label, 2px `cobalt-500` underline and a `void-200` fill.

## Rules

- 2–6 tabs, one word each when possible.
- Blue marks *where you are*; red is reserved for *what you commit* (primary button). Never make a selected tab red.
- In Foundry, map `nav.tabs > a.item.active` to the selected style.
