# Récupération des Prix depuis CSV Typeform

## Vue d'ensemble

Ce système permet de récupérer les prix des projets en contournant les limitations Google Drive en utilisant directement les codes projets extraits des CSV Typeform. Les prix sont ensuite récupérés depuis le site Plum Living via scraping web avec authentification automatique.

> **Note** : Cette méthode remplace l'ancienne méthode via Google Drive qui était limitée par les permissions d'accès aux dossiers.

## Architecture

### Flux de données

```
CSV Typeform PP/Client
    ↓
Parser CSV (extraction codes projets, noms, dates)
    ↓
Mapping NAME + DATE avec requests existantes
    ↓
Récupération prix depuis Plum Living (avec login)
    ↓
Mise à jour des requests avec projectCode et prix
```

## Structure des CSV Typeform

### CSV PP (responses-a25xCDxH-*.csv)
- **Colonne AT (index 45)** : Code UUID du projet
- **Colonne 39** : Last name (nom du client)
- **Colonne 51** : Submit Date (UTC) - format "2025-11-22 12:24:08"
- **Colonne email** : Email du client
- **Total colonnes** : 55

### CSV Client (responses-oIygOgih-*.csv)
- **Colonne W (index 22)** : Code UUID du projet
- **Colonne 14** : Name (nom du client)
- **Colonne 29** : Submit Date (UTC) - format "2025-11-22 11:13:39"
- **Colonne 12** : Price (prix existant dans le CSV, optionnel)
- **Colonne email** : Email du client
- **Total colonnes** : 33

## Mapping avec les Requests

Le système fait correspondre les codes projets aux requests existantes en utilisant :

1. **NAME + DATE** (stratégie principale)
   - Normalise les noms (uppercase, retrait caractères spéciaux)
   - Normalise les dates au format ISO (YYYY-MM-DD)
   - Match exact : `NORMALIZED_NAME|YYYY-MM-DD`
   - Filtre par type (PP vs Client)

2. **projectCode existant** (si déjà assigné)
   - Si une request a déjà un `projectCode`, match direct

3. **Email + DATE** (fallback si nom non disponible)
   - Extrait le nom depuis l'email
   - Match approximatif avec la date

### Taux de réussite attendu
- **~73%** des projets peuvent être matchés avec les requests existantes
- Les 27% restants nécessitent un mapping manuel ou des critères supplémentaires

## Authentification Plum Living

Le système se connecte automatiquement à Plum Living avec les credentials configurés :

### Variables d'environnement (recommandé)
```bash
export PLUM_LIVING_EMAIL="souheil@plum-living.com"
export PLUM_LIVING_PASSWORD="Lbooycz7"
```

### Valeurs par défaut
Si les variables d'environnement ne sont pas définies, le système utilise les valeurs hardcodées (à éviter en production).

## Récupération des Prix

### Processus de scraping

1. **Connexion automatique**
   - Détecte si redirection vers `/login`
   - Remplit le formulaire de connexion
   - Attend la redirection vers la page du projet

2. **Extraction du prix total**
   - Cherche dans les éléments avec classe `mantine-nzjykg` (prix total formaté)
   - Format attendu : "5 938 €" (avec espaces comme séparateurs de milliers)
   - Filtre les prix raisonnables (entre 1000 et 1000000)
   - Prend le plus grand nombre trouvé (prix total)

3. **Gestion des erreurs**
   - Retry automatique en cas d'échec de connexion
   - Timeout de 30 secondes par page
   - Logs détaillés pour debugging

### Performance

- **5 projets en parallèle** (maxConcurrent = 5)
- **~10-15 secondes par projet** (connexion + scraping)
- **Délai de 1 seconde** entre chaque batch
- **Estimation totale** : ~2-3 heures pour 3058 projets

## Utilisation

### Script Standalone

```bash
# Récupération complète (cherche automatiquement les CSV dans Downloads)
npx tsx scripts/fetch-prices-from-csv.ts

# Avec chemins spécifiques
npx tsx scripts/fetch-prices-from-csv.ts \
  --pp-csv /path/to/pp.csv \
  --client-csv /path/to/client.csv

# Utiliser les prix existants du CSV comme fallback
npx tsx scripts/fetch-prices-from-csv.ts --use-existing-prices

# Mode test (sans sauvegarder)
npx tsx scripts/fetch-prices-from-csv.ts --dry-run

# Ne pas assigner les codes projets
npx tsx scripts/fetch-prices-from-csv.ts --no-assign-codes
```

### Route API

```bash
POST /api/prices/from-csv

Body (optionnel):
{
  "ppCsvPath": "/path/to/pp.csv",
  "clientCsvPath": "/path/to/client.csv",
  "useExistingPrices": false,
  "assignProjectCodes": true
}
```

### Script de Test

```bash
# Tester avec 2 projets (1 PP + 1 Client)
npx tsx scripts/test-csv-price-fetcher.ts
```

### Vérification de la Progression

```bash
# Vérifier la progression en temps réel
npx tsx scripts/check-price-progress.ts

# Ou consulter le log directement
tail -f /tmp/fetch-prices.log
```

## Fichiers Créés/Modifiés

### Nouveaux fichiers
- `lib/typeform-csv-parser.ts` - Parser pour les CSV Typeform
- `lib/project-mapping.ts` - Mapping entre codes projets et requests
- `app/api/prices/from-csv/route.ts` - Route API pour synchronisation
- `scripts/fetch-prices-from-csv.ts` - Script standalone
- `scripts/test-csv-price-fetcher.ts` - Script de test
- `scripts/check-price-progress.ts` - Script de monitoring

### Fichiers modifiés
- `lib/types.ts` - Ajout de `projectCode?: string` à `Request`
- `lib/price-fetcher.ts` - Ajout de `fetchPricesFromTypeformCSV()` et `loginToPlumLiving()`

## Structure des Données

### ProjectData (depuis CSV)
```typescript
interface ProjectData {
  projectCode: string;        // UUID du projet
  type: 'PP' | 'Client';
  price?: number;             // Prix existant (Client uniquement)
  email?: string;             // Email du client
  submitDate?: string;        // Date de soumission (YYYY-MM-DD)
  clientName?: string;        // Nom du client
}
```

### MappingResult
```typescript
interface MappingResult {
  matched: Map<string, Request>;  // projectCode -> Request
  unmatched: string[];             // Codes projets non matchés
  stats: {
    totalProjects: number;
    matched: number;
    unmatched: number;
  };
}
```

## Exemple de Sortie

```
🚀 Récupération des prix depuis CSV Typeform

📄 CSV Files:
   PP CSV: /Users/sou/Downloads/responses-a25xCDxH-*.csv
   Client CSV: /Users/sou/Downloads/responses-oIygOgih-*.csv

📊 Parsing Typeform CSVs...
✅ Parsed 3058 projects:
   - PP: 2194
   - Client: 974
   - With existing prices: 974

💰 Fetching prices from Plum Living...
   Max concurrent requests: 5
   This may take a while...

🔗 Mapping projects to requests...
✅ Mapping results:
   - Matched: 2239
   - Unmatched: 819

💾 Updating requests with prices...
✅ Updated 2239 requests

📊 Summary:
   Projects parsed: 3058
   Prices fetched: 3058
   Requests matched: 2239
   Requests updated: 2239
```

## Dépannage

### Problèmes courants

1. **CSV non trouvés**
   - Vérifier que les fichiers sont dans `/Users/sou/Downloads/`
   - Ou fournir les chemins avec `--pp-csv` et `--client-csv`

2. **Connexion échouée**
   - Vérifier les credentials dans les variables d'environnement
   - Vérifier que le compte n'est pas bloqué

3. **Prix non trouvés**
   - Vérifier que le projet existe sur Plum Living
   - Vérifier que le compte a accès au projet
   - Consulter les logs pour plus de détails

4. **Mapping faible**
   - Vérifier que les noms dans les CSV correspondent aux noms dans les requests
   - Vérifier que les dates sont au bon format
   - Certains projets peuvent nécessiter un mapping manuel

## Limitations

- **Temps de traitement** : ~2-3 heures pour 3058 projets
- **Taux de matching** : ~73% (819 projets non matchés)
- **Dépendance Puppeteer** : Nécessite Chrome/Chromium installé
- **Authentification** : Nécessite des credentials valides Plum Living
- **Rate limiting** : 5 requêtes en parallèle max pour éviter le rate limiting

## Améliorations Futures

- [ ] Cache des prix pour éviter les re-scraping
- [ ] Support de reprise après interruption
- [ ] Mapping amélioré avec plus de critères
- [ ] Interface web pour le monitoring en temps réel
- [ ] Export des projets non matchés pour mapping manuel

