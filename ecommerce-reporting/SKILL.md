---
name: ecommerce-reporting
description: Produit le reporting hebdomadaire d'un site de vente en ligne sous forme de dashboard HTML autonome (un seul fichier, clair/sombre, imprimable en PDF) avec CA net vs S-1 / N-1 / objectif, cumul annuel, compte de résultat complet (marge brute, coûts variables, frais fixes, EBITDA, résultat d'exploitation), cascade, ventes par catégorie, top produits, pays, tunnel de conversion, canaux d'acquisition et ROAS, clients nouveaux/récurrents, faits marquants automatiques et analyse rédigée. Utilise cette skill dès que l'utilisateur veut un reporting, un rapport, un dashboard, un tableau de bord, un suivi des ventes ou des KPI pour une boutique en ligne / un e-shop / un site e-commerce, demande « le rapport de la semaine », « fais le reporting de <boutique> », « crée un profil pour un nouveau site », ou veut tester le dashboard avec des données factices. Fonctionne aujourd'hui avec des données FACTICES générées à partir d'un profil boutique ; un connecteur réel (Shopify, WooCommerce, PrestaShop, base SQL) pourra produire le même dataset.json plus tard.
---

# Reporting e-commerce hebdomadaire

Cette skill transforme les données hebdomadaires d'une boutique en ligne en un **dashboard HTML autonome** prêt à partager. Elle est construite en trois couches séparées pour pouvoir changer de source de données sans toucher au rapport :

```
profil boutique (profiles/*.json)
        │
        ▼
source de données ──► dataset.json (schéma normalisé, references/data-schema.md)
  • generate-fake-data.mjs  (aujourd'hui : données factices calibrées)
  • connecteur réel          (plus tard : Shopify, WooCommerce, PrestaShop, SQL…)
        │
        ▼
kpi.mjs (résumé chiffré) ──► analyse rédigée (notes.json)
        │
        ▼
build-report.mjs ──► dashboard-AAAA-Wss.html (un seul fichier, aucune dépendance)
```

Tous les calculs d'indicateurs vivent dans `scripts/lib/metrics.mjs`, utilisé à la fois par les scripts Node et par le dashboard (le fichier y est injecté). Un chiffre affiché dans le rapport et un chiffre cité dans l'analyse viennent donc toujours du même calcul.

**Prérequis** : Node.js 18 ou plus. Aucune dépendance npm.

Dans les commandes ci-dessous, `<SKILL>` désigne le dossier de cette skill (celui qui contient ce fichier). Les sorties vont dans le dossier de travail de l'utilisateur, jamais dans le dossier de la skill.

## Déroulé

### 1. Identifier la boutique et son profil

- Si l'utilisateur nomme une boutique qui a déjà un profil dans `<SKILL>/profiles/`, utilise-le.
- Sinon, crée un profil en copiant `profiles/demo-mode.json` et en l'adaptant (voir « Créer un profil pour un nouveau site » plus bas). Pose seulement les questions dont la réponse change vraiment le rapport : nom de la boutique, secteur, CA annuel approximatif, marge visée, pays principaux. Pour le reste (catégories, produits, canaux, coûts), propose des valeurs réalistes pour le secteur et dis-le.
- Profil de démonstration fourni : `demo-mode` (« Atelier Verso », prêt-à-porter, ~500 000 € de CA net HT sur 12 mois glissants, marge brute ~62 %, marge d'exploitation ~25 %).

### 2. Obtenir le dataset

**Données factices** (mode actuel) :

```bash
node <SKILL>/scripts/generate-fake-data.mjs --profile <SKILL>/profiles/<slug>.json --out reporting/<slug>
```

- Options : `--to 2026-W45` pour arrêter la série à une semaine donnée (par défaut : la valeur `fake.to` du profil). Mets `fake.to` à la **dernière semaine complète** (la semaine ISO qui précède la semaine en cours) quand tu génères un rapport « de la semaine ».
- Le générateur est déterministe (graine `fake.seed`) et se calibre seul : CA net des 52 dernières semaines = `annual_net_revenue`, résultat d'exploitation = `target_operating_margin`. Il affiche un résumé de contrôle ; vérifie-le avant de continuer.

**Données réelles** : pas encore implémenté. Ne te connecte à aucune base ni API d'un site sans accord explicite de l'utilisateur. Le contrat à respecter et la marche à suivre pour écrire un connecteur sont dans `references/connecteurs.md`.

### 3. Lire les chiffres et rédiger l'analyse

```bash
node <SKILL>/scripts/kpi.mjs --dataset reporting/<slug>/dataset.json --week 2026-W45
```

(`--json` donne le contexte complet en JSON.) À partir de ce résumé, écris `reporting/<slug>/notes-<semaine>.json` :

```json
[{ "week": "2026-W45", "title": "Analyse de la semaine 45", "author": "…", "date": "AAAA-MM-JJ",
   "body": "Paragraphe d'ouverture.\n\n- point 1\n- point 2\n\n**À faire** : …" }]
```

Règles de rédaction de l'analyse :
- Commence par le verdict de la semaine en une phrase (dans/hors objectif, tendance vs N-1).
- **Explique** les écarts au lieu de les répéter : le dashboard montre déjà les chiffres. Cherche la cause (événement, S-1 exceptionnelle, mix catégories, remises, conversion, panier moyen, canal).
- 3 à 5 puces maximum, puis une ligne **À faire** avec une ou deux actions concrètes.
- Cite uniquement des chiffres sortis de `kpi.mjs` ; ne recalcule pas à la main. Pourcentages au format belge (`+17,0 %`, `1,86 %`, `64,3 %`), montants arrondis à l'euro.
- Mise en forme acceptée : paragraphes, listes `- `, `**gras**`, `*italique*`. Pas de HTML.
- Si les données sont factices, garde une mention « données factices » dans `author`.

### 4. Construire le dashboard

```bash
node <SKILL>/scripts/build-report.mjs --dataset reporting/<slug>/dataset.json --week 2026-W45 --notes reporting/<slug>/notes-2026-W45.json
```

Sortie par défaut : `reporting/<slug>/dashboard-2026-W45.html` (≈ 450 Ko). Le fichier embarque toutes les semaines : l'utilisateur peut naviguer de semaine en semaine (sélecteur, flèches ◀ ▶ ou touches ← →, clic sur le graphique). L'analyse rédigée s'affiche uniquement sur la semaine à laquelle elle se rapporte.

### 5. (Option) Exporter les données vers Excel / Google Sheets

```bash
node <SKILL>/scripts/export-xlsx.mjs --dataset reporting/<slug>/dataset.json
```

Produit `<slug>-reporting-data.xlsx` (onglets Lisez-moi, Hebdo, Catégories, Canaux, Pays, Produits, Catalogue, Objectifs), avec exactement les chiffres du dashboard. Pour un Google Sheet existant : déposer le fichier sur le Drive, puis dans le Sheet Fichier › Importer › Drive › « Remplacer la feuille de calcul » (le lien du Sheet ne change pas).

### 6. Vérifier et livrer

- Ouvre le fichier dans le navigateur intégré et contrôle au moins : la vue d'ensemble, la cascade, le compte de résultat, l'absence d'erreur console.
- Export PDF : bouton imprimante du dashboard (impression navigateur, thème clair forcé).
- Donne à l'utilisateur le chemin du fichier HTML et les 2-3 points clés de la semaine.

## Contenu du dashboard

| Section | Contenu |
|---|---|
| Vue d'ensemble | CA net HT de la semaine (vs S-1, N-1, objectif), encaissé TTC, commandes, marge brute, résultat ; cumul annuel avec jauge vs objectif annuel et repère « attendu à date » ; 8 tuiles avec mini-courbes 13 semaines ; courbe 52 semaines réalisé / N-1 / objectif ; faits marquants automatiques + analyse rédigée |
| Répartition | Six anneaux (camemberts évidés), au choix sur la semaine ou le cumul annuel : ventes par catégorie, par pays, par canal, « où va chaque euro de CA » (achats, logistique, paiement, marketing, frais fixes, amortissements, résultat), dépenses marketing par poste, commandes nouveaux / récurrents. Légende avec montants et parts, survol pour le détail. La couleur suit l'entité (ordre du profil) et ne change pas d'une période à l'autre |
| Rentabilité | Cascade CA net → achats → logistique → paiement → marketing → frais fixes → amortissements → résultat ; taux de marge brute / sur coûts variables / d'exploitation sur 52 semaines ; compte de résultat détaillé (semaine, S-1, N-1, cumul, cumul N-1, % du CA) avec détail dépliable du marketing et des frais fixes |
| Ventes | Catégories (CA net, part, vs S-1, vs N-1, unités, marge, taux de retour avec alerte) ; top 10 produits ; pays |
| Acquisition | Tunnel sessions → panier → paiement → commande ; dépenses marketing empilées sur 13 semaines ; performance par canal (sessions, conversion, CA, dépense, ROAS, coût par commande) |
| Clients | Nouveaux vs récurrents sur 13 semaines ; nouveaux clients, part récurrente, coût d'acquisition (CAC), articles par commande |

Les seuils d'alerte (taux de retour, marge brute, marge d'exploitation, MER, chute de conversion) se règlent dans `alerts` du profil.

## Définitions des indicateurs

- **CA net HT** = ventes HT après remises − retours. C'est la base de tous les « % du CA ».
- **Ventes HT au prix catalogue** = ventes avant remises ; **remises** = écart avec le prix payé.
- **Encaissé TTC** = ventes après remises × (1 + TVA), avant retours.
- **Marge brute** = CA net HT − coût d'achat des marchandises vendues.
- **Marge sur coûts variables** = marge brute − transport − emballages − frais de paiement − marketing.
- **EBITDA** = marge sur coûts variables − frais fixes. **Résultat d'exploitation** = EBITDA − amortissements.
- **Panier moyen HT** = ventes HT après remises ÷ commandes. **Conversion** = commandes ÷ sessions.
- **Taux de retour** = retours ÷ ventes HT après remises.
- **MER** (marketing efficiency ratio) = CA net HT ÷ dépenses marketing totales. **ROAS canal** = CA HT du canal ÷ dépense du canal.
- **CAC** = dépenses marketing ÷ nouveaux clients.
- **Objectif hebdomadaire** = budget annuel du profil réparti selon la saisonnalité attendue.

## Créer un profil pour un nouveau site

1. Copie `profiles/demo-mode.json` vers `profiles/<slug>.json` (slug en minuscules, tirets).
2. Adapte `slug`, `name`, `tagline`, `sector`, `locale`, `vat_rate`, `budget` (par année) et `alerts`.
3. Dans `fake` : `annual_net_revenue`, `target_operating_margin`, `growth_yoy`, `avg_order_value_ht`, `conversion_rate`, `monthly_seasonality` (12 coefficients), `events` (semaines ISO de soldes, Black Friday, etc.), `categories` (parts, saison, marge catalogue, taux de retour), `products` (au moins 2 par catégorie), `channels`, `countries`, `variable_costs`, `fixed_costs_annual`.
4. Lance le générateur : si le calibrage des frais fixes affiche un facteur hors de 0,5–1,5, les coûts variables ou la marge visée sont incohérents. Ajuste les frais fixes de base (ou les coûts variables) jusqu'à un facteur proche de 1.
5. Le détail de chaque champ est dans `references/data-schema.md` (section Profil).

Les noms de boutique et de produits des profils de test doivent être inventés : n'utilise pas le nom ou la marque d'une enseigne réelle pour des données factices.

## Fichiers

- `scripts/generate-fake-data.mjs` : génère `dataset.json` à partir d'un profil.
- `scripts/kpi.mjs` : résumé chiffré d'une semaine (texte ou `--json`).
- `scripts/build-report.mjs` : assemble le dashboard HTML (`--notes` optionnel).
- `scripts/lib/metrics.mjs` : calculs (source unique, aussi injectée dans le HTML).
- `scripts/lib/weeks.mjs`, `scripts/lib/rng.mjs` : semaines ISO, aléatoire déterministe.
- `templates/dashboard.html` : gabarit du dashboard à la charte AB-Arts (bandeau sombre, accent ember, Geist / Geist Mono, graphiques SVG faits main, sans bibliothèque).
- `assets/fonts/geist-fontface.css`, `assets/ab-arts-logo.png` : polices et logo AB-Arts, embarqués dans le HTML à la construction.
- `scripts/export-xlsx.mjs` : export du dataset en classeur Excel (sans dépendance), importable dans Google Sheets.
- `scripts/serve.mjs` : petit serveur local pour prévisualiser les rapports (`node scripts/serve.mjs reporting/<slug>`).
- `profiles/demo-mode.json` : profil de démonstration.
- `examples/demo-mode/` : dataset, analyse et dashboard d'exemple (semaine 2026-W45).
- `references/data-schema.md` : schéma du profil et du dataset.
- `references/connecteurs.md` : comment brancher une vraie boutique.
