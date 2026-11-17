# Crea — skills AB-Arts

Dépôt des skills Claude développées par AB-Arts, et de l'app Next.js qui publie le reporting.

| Élément | Rôle | État |
|---|---|---|
| [`ecommerce-reporting/`](ecommerce-reporting/SKILL.md) | Skill de reporting hebdomadaire d'un site de vente en ligne : dashboard HTML autonome (ventes, rentabilité, acquisition, clients), export Excel / Google Sheets | Données factices · connecteurs réels à venir |
| `app/`, `lib/`, `next.config.mjs` | App Next.js qui sert le dashboard sur le web (Vercel) | Prête à déployer |

## L'app web (Next.js)

Une page par section, toutes générées au build (pages statiques) et adaptées au mobile :

| Route | Contenu |
|---|---|
| `/` | Vue d'ensemble |
| `/repartition` | Répartition (camemberts) |
| `/rentabilite` | Rentabilité (cascade, marges, compte de résultat) |
| `/ventes` | Ventes (catégories, produits, pays) |
| `/acquisition` | Acquisition (tunnel, marketing, canaux) |
| `/clients` | Clients |
| `/api/dataset` | Les données brutes du dashboard (JSON) |

La semaine choisie suit d'une page à l'autre grâce au paramètre `?semaine=AAAA-Wss` (ex. `/ventes?semaine=2026-W40`), qu'on peut aussi partager tel quel.

```bash
npm install
npm run check   # contrôle : dataset valide, dashboard généré
npm run dev     # http://localhost:3000
npm run build   # build de production
```

### Déployer sur Vercel

1. Sur vercel.com : **Add New › Project**, importer le dépôt GitHub `AB-Arts/Crea`.
2. Laisser les réglages détectés : framework **Next.js**, dossier racine `./` (racine du dépôt), commande `next build`. Aucune variable d'environnement n'est nécessaire pour la démo.
3. **Deploy**. Chaque `git push` sur `main` redéploie ensuite automatiquement.

Variables d'environnement facultatives (Settings › Environment Variables) :

| Variable | Rôle | Défaut |
|---|---|---|
| `REPORTING_DATASET` | Chemin du `dataset.json` à afficher | `ecommerce-reporting/examples/demo-mode/dataset.json` |
| `REPORTING_NOTES` | Chemin du fichier d'analyses rédigées | `ecommerce-reporting/examples/demo-mode/notes-2026-W45.json` |
| `REPORTING_WEEK` | Semaine affichée à l'ouverture (`AAAA-Wss`) | la dernière du dataset |

Le site renvoie `X-Robots-Tag: noindex` : il n'est pas référencé par les moteurs de recherche, mais reste accessible à qui a le lien. **Avant d'y mettre de vraies données**, activer la protection du projet (Settings › Deployment Protection › Vercel Authentication) ou ajouter une connexion.

## La skill en ligne de commande (Node.js 20+, aucune dépendance)

```bash
cd ecommerce-reporting
node scripts/generate-fake-data.mjs --profile profiles/demo-mode.json --out ../reporting/demo-mode
node scripts/kpi.mjs --dataset ../reporting/demo-mode/dataset.json
node scripts/build-report.mjs --dataset ../reporting/demo-mode/dataset.json --notes examples/demo-mode/notes-2026-W45.json
node scripts/export-xlsx.mjs --dataset ../reporting/demo-mode/dataset.json
```

Puis ouvrir `reporting/demo-mode/dashboard-2026-W45.html` dans un navigateur. Un exemple déjà généré se trouve dans `ecommerce-reporting/examples/demo-mode/`.

### Installer la skill dans Claude Code

Copier (ou lier) le dossier `ecommerce-reporting/` dans `~/.claude/skills/` (skill personnelle) ou dans `.claude/skills/` d'un projet.
