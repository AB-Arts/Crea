# Crea — skills AB-Arts

Dépôt des skills Claude développées par AB-Arts.

| Skill | Rôle | État |
|---|---|---|
| [`ecommerce-reporting`](ecommerce-reporting/SKILL.md) | Reporting hebdomadaire d'un site de vente en ligne : dashboard HTML autonome (ventes, rentabilité, acquisition, clients) | Données factices · connecteurs réels à venir |

## Essayer le reporting e-commerce (Node.js 18+, aucune dépendance)

```bash
cd ecommerce-reporting
node scripts/generate-fake-data.mjs --profile profiles/demo-mode.json --out ../reporting/demo-mode
node scripts/kpi.mjs --dataset ../reporting/demo-mode/dataset.json
node scripts/build-report.mjs --dataset ../reporting/demo-mode/dataset.json --notes examples/demo-mode/notes-2026-W45.json
```

Puis ouvrir `reporting/demo-mode/dashboard-2026-W45.html` dans un navigateur.
Un exemple déjà généré se trouve dans `ecommerce-reporting/examples/demo-mode/`.

## Installer la skill dans Claude Code

Copier (ou lier) le dossier `ecommerce-reporting/` dans `~/.claude/skills/` (skill personnelle) ou dans `.claude/skills/` d'un projet.
