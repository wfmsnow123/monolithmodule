"""Gera o kit visual de Monolith (design-system/) para cada módulo.

Saída por módulo: <módulo>/styles/monolith-ui.css, contendo
  1. as fontes (Google Fonts) do design system;
  2. os tokens como variáveis CSS, escopados às janelas de Monolith (nunca em :root, para não
     colidir com outros módulos), tema Abyss por padrão e Ossuary no tema claro do Foundry;
  3. os componentes mono-* do design system (bundle.css);
  4. a "vestimenta" das janelas do Foundry (.application.mono): cabeçalho, título, campos, botões.

Uso: python tools/build-ui.py
"""
import json
import io
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DS = os.path.join(RAIZ, "design-system")

# Seletores que recebem os tokens em cada módulo (o calendário também veste as janelas herdadas).
ESCOPOS = {
    "monolith-regras": [".mono", ".mono-card", "#monolith-hud"],
    "monolith-encumbrance": [".mono", ".mono-card"],
    "monolith-resting": [".mono", ".mono-card"],
    "monolith-medidas": [".mono", ".mono-card", ".monolith-tidy"],
    "monolith-perdicao": [".mono", ".mono-card", ".monolith-tidy"],
    "monolith-journals": [".mono", ".mono-card"],
    "monolith-itemizador": [".mono", ".mono-card"],
    "monolith-luzes": [".mono", ".mono-card"],
    "monolith-calendario": [".mono", ".mono-card", ".calendaria", ".calendaria-hud", ".calendar-note-sheet", ".calendaria-cinematic"],
}
DESTINO = {
    "monolith-calendario": os.path.join("monolith-calendario", "styles", "monolith-ui.css"),
}

tokens = json.load(io.open(os.path.join(DS, "tokens.json"), encoding="utf-8"))
bundle = io.open(os.path.join(DS, "components", "bundle.css"), encoding="utf-8").read()
fontes = re.search(r'@import url\("[^"]+"\);', bundle).group(0)
bundle = bundle.replace(fontes, "").strip()
temas = [t["id"] for t in tokens["color"]["themes"]]


def valor(tok, tema):
    v = tok["value"]
    return v.get(tema, v.get(temas[0])) if isinstance(v, dict) else v


def bloco(seletores, tema, incluir_fixos):
    linhas = [",\n".join(seletores) + " {"]
    for tok in tokens["color"]["tokens"]:
        linhas.append(f"  --{tok['name']}: {valor(tok, tema)};")
    for tok in tokens.get("shadow", {}).get("tokens", []):
        linhas.append(f"  --{tok['name']}: {valor(tok, tema)};")
    if incluir_fixos:
        for k, v in tokens["type"]["families"].items():
            linhas.append(f"  --font-{k}: {v};")
        for fam in ("spacing", "radius"):
            for tok in tokens.get(fam, {}).get("tokens", []):
                linhas.append(f"  --{tok['name']}: {tok['value']};")
    linhas.append("}")
    return "\n".join(linhas)


VESTIMENTA = """
/* ---------- Janelas do Foundry vestidas com o design system ---------- */
.application.mono {
  background: var(--void-100); color: var(--ink);
  border: 1px solid var(--void-300); border-top: 3px solid var(--blood-500);
  border-radius: var(--radius-none); box-shadow: var(--shadow-window);
  font-family: var(--font-sans);
}
.application.mono > .window-header {
  background: var(--void-000); color: var(--ink);
  border-bottom: 1px solid var(--void-300); border-radius: var(--radius-none);
}
.application.mono > .window-header .window-title {
  font-family: var(--font-display); font-weight: 400; font-size: 20px;
  letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink);
}
.application.mono > .window-header .window-title::before {
  content: ""; display: inline-block; width: 6px; height: 14px; margin-right: var(--space-2);
  background: var(--blood-500); vertical-align: -1px;
}
.application.mono > .window-header .header-control { color: var(--ink-muted); }
.application.mono > .window-header .header-control:hover { color: var(--blood-text); }
.application.mono > .window-content { background: var(--void-100); color: var(--ink); padding: var(--space-4); }
.application.mono h1, .application.mono h2, .application.mono h3, .application.mono legend {
  font-family: var(--font-display); font-weight: 400; letter-spacing: 0.05em; color: var(--ink);
  border-color: var(--void-300);
}
.application.mono fieldset { border: 1px solid var(--void-300); border-radius: var(--radius-none); }
.application.mono .hint, .application.mono p.hint { font-size: 12px; line-height: 16px; color: var(--ink-muted); }
.application.mono input[type="text"], .application.mono input[type="number"], .application.mono input[type="password"],
.application.mono select, .application.mono textarea {
  background: var(--void-200); color: var(--ink); border: 1px solid var(--void-400);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-pit); font-family: var(--font-sans);
}
.application.mono input::placeholder, .application.mono textarea::placeholder { color: var(--ink-muted); }
.application.mono input[type="checkbox"] { accent-color: var(--blood-500); }
.application.mono button:not(.header-control):not(.mono-tab) {
  font-family: var(--font-label); font-weight: 600; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
  background: var(--void-200); color: var(--ink); border: 1px solid var(--void-400); border-radius: var(--radius-sm);
}
.application.mono button:not(.header-control):not(.mono-tab):hover { border-color: var(--ink-muted); }
.application.mono button[type="submit"], .application.mono button.mono-primary, .application.mono .form-footer button[data-action="ok"] {
  background: var(--blood-500); border-color: var(--blood-500); color: var(--bone);
}
.application.mono button[type="submit"]:hover, .application.mono button.mono-primary:hover { background: var(--blood-600); border-color: var(--blood-600); }
.application.mono button:disabled { opacity: 0.45; cursor: not-allowed; }
.application.mono .form-group { border-bottom: 1px solid var(--void-300); padding: var(--space-2) 0; }
.application.mono :focus-visible { outline: 2px solid var(--ward); outline-offset: 2px; }
.application.mono a { color: var(--cobalt-text); }

/* ---------- Cartões de chat ---------- */
.mono-card {
  background: var(--void-100); color: var(--ink); font-family: var(--font-sans);
  border: 1px solid var(--void-300); border-top: 3px solid var(--blood-500); border-radius: var(--radius-none);
}
.mono-card > header {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-1) var(--space-2); background: var(--void-000);
  font-family: var(--font-display); font-size: 18px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink);
}
.mono-card > header i { color: var(--blood-text); }
.mono-card .mono-card__body, .mono-card > p, .mono-card > ul { padding: var(--space-1) var(--space-2); margin: var(--space-1) 0; }
.mono-card button { font-family: var(--font-label); letter-spacing: 0.12em; text-transform: uppercase; background: var(--blood-500); color: var(--bone); border: 1px solid var(--blood-500); border-radius: var(--radius-sm); }
"""


def gerar(modulo):
    escopo = ESCOPOS[modulo]
    claros = [f"body.theme-light {s}" for s in escopo] + [f".theme-light{s}" for s in escopo if s.startswith(".")] + [f'{s}[data-theme="ossuary"]' for s in escopo]
    partes = [
        "/* Monolith: kit visual gerado por tools/build-ui.py a partir de design-system/. Não edite à mão. */",
        # No calendário o CSS é empacotado junto com outros, então as fontes entram por <link> no código.
        "" if modulo == "monolith-calendario" else fontes,
        bloco(escopo, temas[0], True),
        bloco(claros, temas[1], False),
        bundle,
        VESTIMENTA,
    ]
    destino = os.path.join(RAIZ, DESTINO.get(modulo, os.path.join(modulo, "styles", "monolith-ui.css")))
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    io.open(destino, "w", encoding="utf-8").write("\n\n".join(partes) + "\n")
    return destino


if __name__ == "__main__":
    for m in ESCOPOS:
        print("gerado:", os.path.relpath(gerar(m), RAIZ))
