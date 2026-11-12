# Brancher une vraie boutique (connecteurs)

État actuel : **aucun connecteur réel n'est implémenté**. La skill fonctionne avec des données factices. Ce document décrit comment en ajouter un sans toucher au dashboard.

## Principe

Un connecteur est un script `scripts/connectors/<plateforme>.mjs` qui :

1. lit le profil (`profiles/<slug>.json`) pour connaître la boutique, la TVA, le budget et les seuils ;
2. lit ses identifiants dans des **variables d'environnement** (ou un `.env.local` ignoré par Git), jamais dans le profil ni dans le dépôt ;
3. extrait les données brutes sur la période demandée (`--from 2025-W01 --to 2026-W45`) ;
4. les agrège par semaine ISO et écrit un `dataset.json` conforme à `references/data-schema.md` (avec `meta.source.type` = nom de la plateforme) ;
5. ne modifie jamais rien côté boutique : **lecture seule**.

Ensuite `kpi.mjs` et `build-report.mjs` fonctionnent sans changement.

## Où trouver chaque donnée

| Donnée du dataset | Shopify | WooCommerce | PrestaShop | Autre |
|---|---|---|---|---|
| commandes, ventes, remises, TVA | Admin API `orders` (GraphQL) | REST `/wc/v3/orders` | Webservice `orders` / tables `ps_orders`, `ps_order_detail` | export CSV |
| retours | `refunds` des commandes | `refunds` des commandes | `ps_order_slip` | |
| coût d'achat (COGS) | `inventoryItem.unitCost` | champ méta « coût » (plugin) | `ps_product.wholesale_price` | fichier de coûts |
| catégories, produits | `products`, `collections` | `/wc/v3/products` | `ps_product`, `ps_category` | |
| nouveaux / récurrents | `customer.numberOfOrders` | historique client | `ps_customer` + historique | |
| sessions, tunnel, canaux | Shopify Analytics ou GA4 | GA4 (Data API) | GA4 | GA4 |
| dépenses marketing | Google Ads API, Meta Marketing API, ou CSV mensuel | idem | idem | |
| transport, emballage, paiement | factures transporteur / Stripe, Mollie, PayPal | idem | idem | coûts unitaires du profil |
| frais fixes, amortissements | comptabilité (export mensuel) réparti par semaine | idem | idem | saisie dans le profil |

Quand une donnée n'est pas disponible, le connecteur écrit `0` (coût) ou `null` (objectif) et le signale dans `meta.source.missing: ["sessions", …]` ; il ne l'invente pas.

## Coûts non disponibles dans la boutique

Les frais fixes et certains coûts variables viennent rarement de la plateforme. Option simple : un bloc `costs_model` dans le profil (mêmes clés que `fake.variable_costs` et `fake.fixed_costs_annual`) que le connecteur applique aux volumes réels, puis remplacement par les vrais montants comptables quand ils sont disponibles.

## Sécurité

- Accès en lecture seule (clé API à portée minimale, utilisateur SQL `SELECT` uniquement).
- Identifiants hors du dépôt Git, jamais affichés dans la console ni écrits dans le dataset.
- Le dataset contient des chiffres agrégés par semaine : aucune donnée personnelle de client (nom, e-mail, adresse).
- Ne lancer un connecteur sur une boutique qu'avec l'accord explicite de son propriétaire.

## Liste de contrôle d'un nouveau connecteur

- [ ] Les règles de cohérence du schéma sont vérifiées sur au moins 4 semaines (sommes catégories / canaux / pays).
- [ ] Une semaine connue est comparée au back-office de la boutique (CA, commandes, retours).
- [ ] Les semaines sans vente produisent des zéros, pas des trous.
- [ ] Le fuseau horaire de la boutique est respecté pour le découpage des semaines.
- [ ] `build-report.mjs` passe la validation et le dashboard s'affiche sans erreur console.
