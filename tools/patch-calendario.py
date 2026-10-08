"""Transforma o fork do Calendaria no Calendário de Monolith (idempotente o bastante para rodar uma vez)."""
import io
import json
import os
import re
import shutil

R = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "monolith-calendario")


def rd(p):
    return io.open(os.path.join(R, p), encoding="utf-8").read()


def wr(p, s):
    io.open(os.path.join(R, p), "w", encoding="utf-8").write(s)


def rep(s, o, n, cnt=1):
    assert o in s, f"não achei: {o[:90]}"
    return s.replace(o, n, cnt)


# ---------- 1. Abas e grupos do painel ----------
p = "scripts/applications/settings/settings-panel.mjs"
s = rd(p)
for tab in ["fogofwar", "macros", "chat", "permissions", "canvas", "module", "cinematics", "stopwatch"]:
    s, n = re.subn(r"\n\s*\{ id: '" + tab + r"', group: 'primary'[^\n]*\},?", "", s, count=1)
    assert n == 1, tab
s = rep(s, "    { id: 'technical', label: 'CALENDARIA.SettingsPanel.Group.Technical', tooltip: 'CALENDARIA.SettingsPanel.GroupTooltip.Technical', color: '#f97316' },\n", "")
s = s.replace("color: '#ff144f'", "color: '#a3121b'").replace("color: '#84cc16'", "color: '#a3121b'").replace("color: '#14b8a6'", "color: '#28479a'")
wr(p, s)

# ---------- 2. Rodapé sem links ----------
wr("templates/applications/settings/form-footer.hbs", """<footer class="settings-footer">
  <div class="footer-left">
    <span class="save-indicator" data-state="{{saveState}}">
      <i class="fas {{saveIcon}}"></i>
      {{saveLabel}}
    </span>
  </div>
  <div class="footer-center">
    <span class="module-name">Calendário de Monolith</span>
    <span class="version-link">{{moduleVersion}}</span>
  </div>
  <div class="footer-right"></div>
</footer>
""")

# ---------- 3. Sem mensagem de novidades; semente do calendário; kit visual ----------
p = "calendaria.mjs"
s = rd(p)
s = rep(s, "  await checkReleaseMessage();\n", "")
s = rep(s, "import { initializeFantasyCalendarSync, registerFantasyCalendarSettings } from './scripts/integrations/fantasy-calendar-sync.mjs';",
        "import { initializeFantasyCalendarSync, registerFantasyCalendarSettings } from './scripts/integrations/fantasy-calendar-sync.mjs';\nimport { registerMonolithSeedSettings, seedMonolithCalendar } from './scripts/integrations/monolith-seed.mjs';")
s = rep(s, "  registerFantasyCalendarSettings();\n", "  registerFantasyCalendarSettings();\n  registerMonolithSeedSettings();\n")
s = rep(s, "  await NoteManager.initialize();\n", "  await NoteManager.initialize();\n  await seedMonolithCalendar();\n")
s = rep(s, "import './styles/weather.css';", "import './styles/weather.css';\nimport './styles/monolith-ui.css';\nimport './styles/monolith-calendario.css';")
wr(p, s)

# ---------- 4. Só os importadores do Fantasy-Calendar e de backups do próprio calendário ----------
p = "scripts/importers/importer-registry.mjs"
s = rd(p)
for imp in ["SimpleCalendarImporter", "MiniCalendarImporter", "SeasonsStarsImporter", "SimpleTimekeepingImporter", "CalendariumImporter"]:
    s = rep(s, f"  registerImporter({imp});\n", "")
wr(p, s)

# ---------- 5. Só o gregoriano como reserva ----------
p = "scripts/calendar/calendar-loader.mjs"
s = rd(p)
s = re.sub(r"export const BUNDLED_CALENDARS = \[[^\]]*\];", "export const BUNDLED_CALENDARS = ['gregorian'];", s)
wr(p, s)
for f in os.listdir(os.path.join(R, "calendars")):
    if f.endswith(".json") and f != "gregorian.json":
        os.remove(os.path.join(R, "calendars", f))

# ---------- 6. Temas Monolith ----------
ABYSS = dict(bg="#0e1016", bgLighter="#161a22", bgHover="#1d2230", border="#2a303c", borderLight="#2a303c", divider="#2a303c",
             inputBg="#161a22", text="#e6e2d8", textDim="#8f95a3", textHeading="#e6e2d8", textSecondary="#8f95a3", titleText="#f1ece2",
             weekdayHeader="#8f95a3", dayNumber="#e6e2d8", restDay="#86a3e6", buttonBg="#161a22", buttonText="#e6e2d8", buttonBorder="#636b7e",
             primary="#3557b3", today="#c41d27", accent="#d29a3a", error="#ec5960", warning="#d29a3a", success="#6fae99",
             festivalBorder="#d29a3a", festivalText="#d29a3a", shadow="#000000", overlay="#07080b")
OSSUARY = dict(bg="#f4efe4", bgLighter="#ddd5c4", bgHover="#e9e3d6", border="#b9ad97", borderLight="#b9ad97", divider="#b9ad97",
               inputBg="#ddd5c4", text="#131419", textDim="#4c505b", textHeading="#131419", textSecondary="#4c505b", titleText="#131419",
               weekdayHeader="#4c505b", dayNumber="#131419", restDay="#1f3c86", buttonBg="#ddd5c4", buttonText="#131419", buttonBorder="#7d725f",
               primary="#22408c", today="#9a1018", accent="#8a5a0e", error="#8e0f16", warning="#8a5a0e", success="#2e6b58",
               festivalBorder="#8a5a0e", festivalText="#8a5a0e", shadow="#281e14", overlay="#281e14")


def objeto(nome, cores, doc):
    corpo = ",\n".join(f"  {k}: '{v}'" for k, v in cores.items())
    return f"/** @type {{Object<string, string>}} {doc} */\nexport const {nome} = {{\n{corpo}\n}};"


p = "scripts/utils/theme-utils.mjs"
s = rd(p)
s = re.sub(r"/\*\* @type \{Object<string, string>\} Default color values[^\n]*\*/\nexport const DEFAULT_COLORS = \{[^}]*\};",
           objeto("DEFAULT_COLORS", ABYSS, "Monolith Abyss (escuro), do design system de Monolith."), s, count=1)
s = re.sub(r"export const LIGHT_COLORS = \{[^}]*\};", objeto("LIGHT_COLORS", OSSUARY, "Monolith Ossuary (claro).").split("\n", 1)[1], s, count=1)
s = re.sub(r"export const THEME_PRESETS = \{[^}]*\};",
           "export const THEME_PRESETS = {\n  dark: { name: 'Monolith: Abyss', colors: DEFAULT_COLORS },\n  light: { name: 'Monolith: Ossuary', colors: LIGHT_COLORS }\n};", s, count=1)
wr(p, s)

# ---------- 7. Sem a marca "Calendaria" nos textos ----------
for f in os.listdir(os.path.join(R, "lang")):
    p = os.path.join("lang", f)
    d = json.loads(rd(p))
    for k, v in list(d.items()):
        if isinstance(v, str) and "Calendaria" in v:
            d[k] = v.replace("Calendaria", "Calendário de Monolith" if f.startswith("pt") else "Monolith Calendar")
    wr(p, json.dumps(d, ensure_ascii=False, indent=2) + "\n")

# ---------- 8. Calendário de Monolith embutido ----------
os.makedirs(os.path.join(R, "assets"), exist_ok=True)
src = os.path.join(R, "dev", "tests", "fixtures", "monolith-fc.json")
shutil.copyfile(src, os.path.join(R, "assets", "monolith-fc.json"))

print("calendário transformado")
