# Schéma des données

Deux fichiers JSON structurent la skill :

- le **profil** (`profiles/<slug>.json`) décrit la boutique, ses objectifs et, pour le mode factice, les paramètres de génération ;
- le **dataset** (`dataset.json`) contient les chiffres hebdomadaires. C'est le **contrat** entre une source de données (générateur factice ou connecteur réel) et le dashboard.

Tous les montants sont **HT, en euros, arrondis au centime**, sauf `ttc` et `vat`. Les semaines sont des semaines **ISO 8601** (lundi → dimanche, identifiant `AAAA-Wss`).

---

## 1. Dataset (`dataset.json`, `schema_version: 1`)

```jsonc
{
  "meta": {
    "schema_version": 1,
    "shop":   { "slug": "demo-mode", "name": "Atelier Verso", "tagline": "…", "sector": "Prêt-à-porter",
                "currency": "EUR", "locale": "fr-BE", "vat_rate": 0.21 },
    "source": { "type": "fake | shopify | woocommerce | prestashop | sql | csv", "generated_at": "ISO 8601", "…": "…" },
    "period": { "from": "2025-W01", "to": "2026-W45" },
    "alerts": { "return_rate_max": 0.22, "gross_margin_min": 0.55, "operating_margin_min": 0.10, "mer_min": 7, "conversion_drop_pct": 0.15 },
    "budget": { "2025": 455000, "2026": 520000 },          // objectif annuel de CA net HT
    "catalog": [ { "sku": "PL-004", "name": "Pull col rond mérinos", "category": "Pulls & sweats", "price_ht": 65.29 } ]
  },
  "weeks": [ /* une entrée par semaine, ordre chronologique, sans trou */ ]
}
```

### Une semaine

| Champ | Type | Définition |
|---|---|---|
| `id` | string | `2026-W45` |
| `year`, `week` | number | année ISO et numéro de semaine ISO |
| `start`, `end` | string | lundi et dimanche (`AAAA-MM-JJ`) |
| `event` | string \| null | événement commercial (soldes, Black Friday…) |
| `traffic.sessions` | int | sessions du site |
| `traffic.add_to_cart` | int | sessions avec ajout au panier |
| `traffic.checkouts` | int | paiements initiés |
| `sales.list_ht` | € | ventes au prix catalogue, avant remises |
| `sales.discounts` | € | remises accordées (`list_ht − gross_ht`) |
| `sales.gross_ht` | € | ventes après remises, avant retours |
| `sales.returns` | € | montant HT des retours remboursés |
| `sales.net_ht` | € | **CA net HT** = `gross_ht − returns` |
| `sales.vat`, `sales.ttc` | € | TVA et encaissé TTC sur `gross_ht` |
| `sales.orders` | int | commandes |
| `sales.units` | int | articles vendus |
| `sales.returned_orders` | int | commandes avec au moins un retour |
| `sales.new_customers` | int | commandes de nouveaux clients |
| `sales.returning_customers` | int | commandes de clients récurrents (`orders − new_customers`) |
| `costs.cogs` | € | coût d'achat des marchandises vendues (sur le CA net) |
| `costs.shipping` | € | transport aller et retours |
| `costs.packaging` | € | emballages |
| `costs.payment_fees` | € | commissions des prestataires de paiement |
| `costs.marketing` | objet | `{ google_ads, meta_ads, influence, emailing, affiliation, … }` — clés libres, libellés dans `COST_LABELS` |
| `costs.fixed` | objet | `{ salaries, rent, software, content, accounting, insurance, other, … }` — part hebdomadaire des frais fixes |
| `costs.depreciation` | € | amortissements de la semaine |
| `budget.net_ht` | € \| null | objectif de CA net HT de la semaine |
| `categories[]` | | `{ name, gross_ht, discounts, returns, net_ht, cogs, units }` |
| `channels[]` | | `{ key, name, sessions, orders, revenue_ht, spend }` — `revenue_ht` avant retours |
| `countries[]` | | `{ code, name, orders, revenue_ht }` — `revenue_ht` avant retours |
| `products[]` | | `{ sku, units, revenue_ht }` — nom et catégorie via `meta.catalog` |

### Règles de cohérence (à respecter par tout connecteur)

1. `net_ht = gross_ht − returns` et `gross_ht = list_ht − discounts`.
2. `Σ categories.gross_ht ≈ gross_ht`, `Σ categories.net_ht ≈ net_ht`, `Σ categories.cogs ≈ costs.cogs`.
3. `Σ channels.sessions ≈ traffic.sessions`, `Σ channels.orders = orders`, `Σ countries.orders = orders`.
4. `sessions ≥ add_to_cart ≥ checkouts ≥ orders`.
5. Semaines consécutives, sans trou. Au moins 53 semaines pour avoir les comparaisons N-1 sur toute la courbe.
6. Une donnée inconnue vaut `0` pour un coût, `null` pour un objectif ; ne jamais inventer un chiffre dans un connecteur réel.
7. Une clé de coût ajoutée dans `marketing` ou `fixed` apparaît automatiquement dans le compte de résultat ; ajouter son libellé dans `COST_LABELS` (`scripts/lib/metrics.mjs`).

---

## 2. Profil (`profiles/<slug>.json`)

| Champ | Rôle |
|---|---|
| `slug`, `name`, `tagline`, `sector` | identité affichée dans le dashboard |
| `currency`, `locale`, `vat_rate` | formatage (`fr-BE` par défaut) et TVA |
| `data_source` | `{ type, note }` — type de source prévue |
| `alerts` | seuils des faits marquants automatiques |
| `budget` | objectif annuel de CA net HT, par année |
| `fake` | paramètres du générateur factice (ignorés par un connecteur réel) |

### Section `fake`

| Champ | Rôle |
|---|---|
| `seed` | graine aléatoire (même graine → mêmes données) |
| `from`, `to` | première et dernière semaine générées |
| `annual_net_revenue` | CA net HT visé sur les 52 dernières semaines (calibrage automatique) |
| `target_operating_margin` | résultat d'exploitation visé en % du CA net (calibre les frais fixes) |
| `growth_yoy` | croissance annuelle appliquée en tendance |
| `noise` | aléa hebdomadaire (écart relatif, ~0,05) |
| `avg_order_value_ht`, `units_per_order` | panier moyen HT, articles par commande |
| `conversion_rate`, `cart_to_checkout`, `checkout_completion` | tunnel de conversion |
| `new_customer_share` | part des commandes de nouveaux clients |
| `base_discount` | remise moyenne hors événements |
| `monthly_seasonality` | 12 coefficients de demande (janvier → décembre) |
| `events[]` | `{ name, weeks[], uplift[], discount, conversion, aov, cpc }` par semaine ISO |
| `season_profiles` | courbes mensuelles nommées utilisées par les catégories |
| `categories[]` | `{ name, share, season, list_margin, return_rate }` — `list_margin` = marge au prix catalogue ; la marge réelle baisse avec les remises |
| `products[]` | `{ sku, name, category, price_ht, weight }` |
| `channels[]` | `{ key, name, share, conversion, cost }` avec `cost.type` = `none`, `cpc` (€/session), `monthly` (€/mois) ou `commission` (% du CA) et `cost.line` = clé marketing |
| `countries[]` | `{ code, name, share }` |
| `variable_costs` | transport par commande et par retour, emballage par commande, frais de paiement (% du TTC + fixe par commande) |
| `fixed_costs_annual` | frais fixes de base (mis à l'échelle par le calibrage) |
| `fixed_costs_prev_year_factor` | frais fixes de l'année précédente en proportion |
| `depreciation_annual` | amortissements annuels |
