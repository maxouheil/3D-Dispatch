# Analyse d'Intégration Google Sheets - Admin Dashboard

## 📊 Structure Actuelle du Système

### Données Actuelles
Le système utilise actuellement des fichiers JSON locaux :
- `/data/requests.json` - Liste des requêtes
- `/data/artists.json` - Liste des artistes

### API Routes Existantes
- `GET /api/requests` - Récupère toutes les requêtes
- `GET /api/artists` - Récupère tous les artistes
- `PUT /api/requests/[id]` - Met à jour une requête
- `POST /api/requests` - Crée une nouvelle requête

### Structure des Données

#### Request (Requête)
```typescript
{
  id: string;
  number: number;
  clientName: string;
  ppName?: string;
  type: 'PP' | 'Client';
  date: string;
  status: 'new' | 'ongoing' | 'correction' | 'sent';
  assignedTo: string | null;
  price: number;
  ikpLink: string;
  design: string;
  colors: { haut?: string; bas?: string; colonne?: string };
  description: string;
  thumbnail: string;
  renders: Render[];
}
```

#### Artist (Artiste)
```typescript
{
  id: string;
  name: string;
  targetPerWeek: number;
  currentWeekCompleted: number;
  backlogCount: number;
  ongoingCount: number;
  sentCount: number;
  performanceScore: number;
}
```

## 🔗 Options d'Intégration Google Sheets

### Option 1: Google Sheets API (Recommandée)
**Avantages:**
- ✅ Accès en temps réel aux données
- ✅ Synchronisation bidirectionnelle possible
- ✅ Contrôle d'accès via OAuth 2.0
- ✅ Pas de limite de taille de données

**Inconvénients:**
- ⚠️ Nécessite une configuration OAuth
- ⚠️ Plus complexe à mettre en place

### Option 2: Export CSV/JSON Public
**Avantages:**
- ✅ Simple à mettre en place
- ✅ Pas d'authentification nécessaire

**Inconvénients:**
- ⚠️ Données statiques (nécessite un refresh manuel)
- ⚠️ Le spreadsheet doit être public

### Option 3: Google Apps Script Webhook
**Avantages:**
- ✅ Synchronisation automatique
- ✅ Peut déclencher des mises à jour

**Inconvénients:**
- ⚠️ Nécessite du code Google Apps Script
- ⚠️ Plus complexe

## 🎯 Recommandation: Google Sheets API

### Architecture Proposée

```
Google Sheets (Source de vérité)
    ↓
API Route Next.js (/api/sheets/sync)
    ↓
Cache local (JSON) ou Base de données
    ↓
API Routes existantes (/api/requests, /api/artists)
    ↓
Frontend (React Components)
```

### Mapping Colonnes Spreadsheet → Types TypeScript

**Pour analyser précisément votre spreadsheet, j'ai besoin de connaître:**
1. Les noms des colonnes dans votre Google Sheet
2. Les onglets/feuilles (Requests, Artists, etc.)
3. Le format des données (dates, nombres, etc.)

**Exemple de mapping attendu:**

#### Feuille "Requests"
| Colonne Spreadsheet | Champ TypeScript | Type |
|---------------------|------------------|------|
| ID | id | string |
| Number | number | number |
| Client Name | clientName | string |
| Type | type | 'PP' \| 'Client' |
| Date | date | ISO string |
| Status | status | 'new' \| 'ongoing' \| 'correction' \| 'sent' |
| Assigned To | assignedTo | string \| null |
| Price | price | number |
| IKP Link | ikpLink | string |
| Design | design | string |
| Colors Haut | colors.haut | string |
| Colors Bas | colors.bas | string |
| Colors Colonne | colors.colonne | string |
| Description | description | string |
| Thumbnail | thumbnail | string |

#### Feuille "Artists"
| Colonne Spreadsheet | Champ TypeScript | Type |
|---------------------|------------------|------|
| ID | id | string |
| Name | name | string |
| Target Per Week | targetPerWeek | number |
| Current Week Completed | currentWeekCompleted | number |
| Backlog Count | backlogCount | number |
| Ongoing Count | ongoingCount | number |
| Sent Count | sentCount | number |
| Performance Score | performanceScore | number |

## 🛠️ Implémentation Proposée

### Étape 1: Configuration Google Sheets API

1. Créer un projet dans Google Cloud Console
2. Activer Google Sheets API
3. Créer des credentials (Service Account ou OAuth)
4. Partager le spreadsheet avec le service account

### Étape 2: Créer une Route API de Synchronisation

```typescript
// app/api/sheets/sync/route.ts
// Cette route synchronisera les données du spreadsheet vers les fichiers JSON
```

### Étape 3: Mapper les Données

Créer un service de mapping qui convertit les lignes du spreadsheet en objets TypeScript.

### Étape 4: Synchronisation Automatique

- Option A: Webhook depuis Google Apps Script
- Option B: Cron job côté serveur
- Option C: Bouton de synchronisation manuelle dans l'admin

## 📝 Prochaines Étapes

Pour finaliser l'analyse et créer l'implémentation complète, j'ai besoin de:

1. **Accès au spreadsheet** ou liste des colonnes/onglets
2. **Format exact des données** dans le spreadsheet
3. **Préférence d'authentification** (Service Account vs OAuth)
4. **Fréquence de synchronisation** souhaitée (temps réel, toutes les heures, manuel)

---

**Note:** Pour que je puisse analyser précisément votre spreadsheet, vous pouvez:
- Partager temporairement le spreadsheet en lecture seule
- Ou me donner la liste des colonnes et exemples de données
- Ou exporter un CSV/JSON et le partager

---

## 💰 Récupération des Prix

### Méthode Recommandée: Via CSV Typeform

Le système supporte maintenant une nouvelle méthode de récupération des prix qui contourne les limitations Google Drive en utilisant directement les CSV Typeform.

**Documentation complète** : Voir [`docs/PRICE_FETCHING_FROM_CSV.md`](./PRICE_FETCHING_FROM_CSV.md)

**Avantages** :
- ✅ Pas de dépendance aux permissions Google Drive
- ✅ Mapping automatique avec les requests via **NAME + DATE** (~73% de réussite)
- ✅ Connexion automatique à Plum Living avec authentification
- ✅ Plus rapide et fiable

**Utilisation rapide** :
```bash
# Récupération complète des prix
npx tsx scripts/fetch-prices-from-csv.ts

# Vérifier la progression
npx tsx scripts/check-price-progress.ts
```

### Ancienne Méthode: Via Google Drive

L'ancienne méthode via Google Drive est toujours disponible mais peut être limitée par les permissions d'accès aux dossiers. Voir `lib/price-fetcher.ts` pour plus de détails.



