# Report formatting target — ESPRIT PFE (from partage_rapport_Copy_.pdf)

The user's reference report (`C:\Users\EL PANDAs\Downloads\partage_rapport_Copy_.pdf`, 92 pp,
ESPRIT, Data Science, **French**) defines the desired format. Our Medianet report must be
**rewritten in French** and **restructured** to match the ESPRIT layout below.

## Front matter (in order)
1. Page de garde (ESPRIT template: université, filière, titre, "Réalisé par", "Encadré par"
   académique + entreprise, année universitaire, spécialité).
2. Signatures (encadrement académique / professionnel).
3. **Dédicace**.
4. **Remerciements**.
5. **Table des matières**.
6. **Table des figures**.
7. **Liste des tableaux**.

## Body
- **Introduction Générale** (1–2 pp).
- **Chapitre 1 — Cadre Général**
  - Introduction
  - 1.1 Présentation de l'organisme d'accueil (1.1.1 Présentation générale · 1.1.2 Domaines
    d'activité · 1.1.3 Organisation de l'entreprise [organigramme] · 1.1.4 Département d'accueil)
  - 1.2 Présentation du projet
  - 1.3 Étude de l'existant (1.3.1 Description de l'existant · 1.3.2 Critique de l'existant)
  - 1.4 Solution proposée
  - 1.5 Méthodologie de travail (présenter 2–3 méthodes puis « Choix de la méthodologie »)
  - Conclusion
- **Chapitres intermédiaires** (analyse/conception) — each opens with *Introduction* and closes
  with *Conclusion*. For us: « Analyse et spécification des besoins » (acteurs, cas d'utilisation,
  besoins fonctionnels/non-fonctionnels, diagrammes) and « Conception » (diagramme de classes,
  séquence, composant/déploiement).
- **Dernier chapitre — Réalisation**
  - Introduction · Environnement de travail (matériel/logiciel) · Outils utilisés · Architecture
  · Interfaces/Captures d'écran · Conclusion
- **Conclusion Générale** (bilan + perspectives).
- Bibliographie / Webographie.

## Style conventions observed
- Every chapter starts with an **Introduction** and ends with a **Conclusion**.
- Numbered figures/tables ("Figure 1.1", "Tableau 1.1") with a **Table des figures** + **Liste des
  tableaux** auto-generated.
- Company logo + organigramme as figures in 1.1.
- Methodology chapter compares candidate methods then justifies the choice.

## Official ESPRIT formatting rules (from "Rapport Stage Pédagogique.pdf")
- **Length target: ~40 pages (hors annexes)** per the official guide — NOTE: conflicts with the
  user's earlier "60-70 pages" ask; proceeding with substantial content, will disclose the tension.
- **Font:** Times New Roman, 12pt body text.
- **Margins:** 2.5 cm all sides.
- **Line spacing:** 1.15.
- **Justification:** left+right (justified).
- **Paragraphs:** first-line indent 0.5 cm; avoid empty space / a chapter ending on a near-empty page.
- **Document title:** 24pt, centered.
- **Headings:** bold, decreasing size with depth, numbered "1", "1.1", etc. (0.20cm indent from
  page edge, 0.30cm for wrapped lines, 0.20cm between number and title text).
- **Emphasis:** examples in italics; definitions boxed (or not); conclusions/key points in bold.
- **Figures/tables:** every figure/table needs a caption AND an in-text reference; numbered
  consistently by type (Tab. 1, Fig. 1, etc. — example report uses "Figure 1.1" per-chapter numbering).
- **Sources:** cited and listed at the end in a **"Bibliographie/Netographie"** section.
- **Citations:** short quotes in guillemets « ».
- **Page numbers:** bottom-right, format "n/N".
- **Mandatory content (guide):**
  - Each chapter: Introduction → Développement → Conclusion (conclusion summarizes + bridges to next chapter).
  - A "Description du travail réalisé" section must include a **planning** (Gantt/sprint table),
    ideally full-page, near the end of that section, PLUS a description of **difficultés
    rencontrées** and **changements apportés aux objectifs initiaux**.
  - **Conclusion Générale must explicitly cover 5 points:**
    1. Récapitulation de la démarche complète annoncée par l'introduction générale.
    2. Présentation des résultats : réponses aux problèmes posés au début.
    3. Les problèmes rencontrés lors de la réalisation du projet.
    4. Les apports (techniques et autres).
    5. Perspectives d'approfondissement/élargissement du sujet ; ouverture sur d'autres
       expériences ou recherches.
  - No source code inline — technical details go in annexes.

## Action for our report
- Translate `RAPPORT_MEDIANET_INCUBATEUR.md` content to **French** and re-map sections to the
  ESPRIT structure above; keep the existing PlantUML diagrams (relabel "Figure n.m" in French).
- Regenerate the .docx via the markdown→docx generator (recreate `docs/_docxbuild`, `npm i docx`,
  `node gen.js`). Generator currently supports: # ## ### #### headings, ``` / ```figure fences,
  > notes, | tables |, - bullets, N. numbered, title page + TOC.
- Confirm with the user: French vs English, and whether to embed the ESPRIT page-de-garde exactly.
