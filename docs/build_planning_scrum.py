# -*- coding: utf-8 -*-
"""Draw a Scrum release board (releases -> sprints -> increments) to replace the Gantt planning figure."""
import os, textwrap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "planning_scrum.png")

COLS = [
    {"name": "Sprint 0", "sub": "Cadrage", "range": "Préparation", "color": "#7C6FF0", "cards": [
        {"t": "Sprint 0", "d": "2 sem.", "goal": "Cadrage, étude de l'existant, mise en place de l'environnement (Docker, Git, squelette microservices)"},
    ]},
    {"name": "Release 1", "sub": "Fondations & parcours", "range": "US-01 → US-06", "color": "#3B82F6", "cards": [
        {"t": "Sprint 1", "d": "2 sem.", "goal": "Authentification JWT, gestion des utilisateurs & des rôles"},
        {"t": "Sprint 2", "d": "3 sem.", "goal": "Modèle de programme & constructeur de parcours visuel (jour/plage, imbrication)"},
    ]},
    {"name": "Release 2", "sub": "Candidatures, évaluation & IA", "range": "US-07 → US-13", "color": "#10B981", "cards": [
        {"t": "Sprint 3", "d": "2 sem.", "goal": "Candidatures en ligne & formulaire personnalisable"},
        {"t": "Sprint 4", "d": "3 sem.", "goal": "Évaluation par jury, critères pondérés, réévaluation par session"},
        {"t": "Sprint 5", "d": "2 sem.", "goal": "Notation IA Medi & analyse du pitch (transcription, mesures, vision)"},
    ]},
    {"name": "Release 3", "sub": "Visibilité & communications", "range": "US-14 → US-18", "color": "#EC4899", "cards": [
        {"t": "Sprint 6", "d": "2 sem.", "goal": "Visibilité des sessions & couche de validation centralisée"},
        {"t": "Sprint 7", "d": "2 sem.", "goal": "Participants, invitations personnalisées & archive des communications"},
    ]},
    {"name": "Clôture", "sub": "Tests & rapport", "range": "Validation", "color": "#64748B", "cards": [
        {"t": "Sprint 8", "d": "2 sem.", "goal": "Tests de bout en bout, corrections, validation & rédaction du rapport"},
    ]},
]

fig, ax = plt.subplots(figsize=(13.5, 7.6), dpi=200)
ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
fig.patch.set_facecolor("white")

# title
ax.text(50, 97.5, "Feuille de route Scrum — 3 releases, 9 sprints", ha="center", va="top",
        fontsize=16, fontweight="bold", color="#1F2937")
ax.text(50, 92.2, "Livraison itérative et incrémentale (fév. – juil. 2026) : un incrément déployable à la fin de chaque sprint",
        ha="center", va="top", fontsize=10, color="#6B7280", style="italic")

n = len(COLS)
L, R, gap = 2.0, 2.0, 1.6
col_w = (100 - L - R - (n - 1) * gap) / n
hdr_top, hdr_h = 87.0, 8.5
card_top = hdr_top - hdr_h - 2.2
card_h, card_gap = 19.5, 2.6

def rrect(x, y, w, h, fc, ec, lw=1.2, rad=1.4, alpha=1.0):
    p = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={rad}",
                       facecolor=fc, edgecolor=ec, linewidth=lw, alpha=alpha,
                       mutation_aspect=1.0)
    ax.add_patch(p); return p

for i, col in enumerate(COLS):
    x = L + i * (col_w + gap)
    c = col["color"]
    # header
    rrect(x, hdr_top - hdr_h, col_w, hdr_h, fc=c, ec=c, rad=1.4)
    ax.text(x + col_w / 2, hdr_top - 2.6, col["name"], ha="center", va="center",
            fontsize=12, fontweight="bold", color="white")
    ax.text(x + col_w / 2, hdr_top - 5.7, col["sub"], ha="center", va="center",
            fontsize=8.2, color="white")
    ax.text(x + col_w / 2, hdr_top - 7.6, col["range"], ha="center", va="center",
            fontsize=7.6, color="white", style="italic")
    # cards
    y = card_top
    for card in col["cards"]:
        rrect(x, y - card_h, col_w, card_h, fc="#FFFFFF", ec=c, lw=1.3, rad=1.2)
        # left accent stripe
        rrect(x + 0.0, y - card_h, 0.9, card_h, fc=c, ec=c, rad=0.4)
        # sprint title
        ax.text(x + 1.9, y - 2.6, card["t"], ha="left", va="center",
                fontsize=10.5, fontweight="bold", color="#111827")
        # duration badge
        bx = x + col_w - 5.6
        rrect(bx, y - 3.7, 5.0, 2.4, fc=c, ec=c, rad=0.9, alpha=0.16)
        ax.text(bx + 2.5, y - 2.5, card["d"], ha="center", va="center",
                fontsize=7.8, fontweight="bold", color=c)
        # goal (wrapped)
        wrapped = textwrap.fill(card["goal"], width=27)
        ax.text(x + 1.9, y - 5.6, wrapped, ha="left", va="top",
                fontsize=8.3, color="#374151", linespacing=1.25)
        y -= (card_h + card_gap)

# incremental flow arrow along the bottom
ax.annotate("", xy=(97.5, 6.0), xytext=(2.5, 6.0),
            arrowprops=dict(arrowstyle="-|>", color="#9CA3AF", lw=1.6))
ax.text(50, 3.4, "Valeur livrée de façon incrémentale  ·  intégration & déploiement continus (Docker Compose)",
        ha="center", va="center", fontsize=8.6, color="#6B7280")

plt.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
fig.savefig(OUT, dpi=200, facecolor="white", bbox_inches="tight", pad_inches=0.15)
print("saved", OUT)
