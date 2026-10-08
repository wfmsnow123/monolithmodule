# Window

The application frame for every Monolith module window: a black header with a red sigil, a blood-red top edge, square corners.

## Anatomy

- `.mono-window` — the frame. 3px `blood-500` top edge, 1px `void-300` border, `shadow-window`.
- `.mono-window__header` — `void-000` bar holding `.mono-window__sigil`, `.mono-window__title` (Bebas Neue, uppercase) and `.mono-window__close`.
- `.mono-window__body` — `space-4` padding on `void-100`.
- `.mono-window__footer` — right-aligned actions on `void-000`; primary button last.

## In Foundry

Foundry draws its own window chrome. Add the class `mono` to your application's root element (`classes: ["mono", "mono-window"]` in `DEFAULT_OPTIONS` for ApplicationV2) and style `.window-header` with the same tokens, or render the header markup above inside your template for custom dialogs.

Title format: `Monolith · <Module>`.
