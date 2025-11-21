# Mapping Final - Spreadsheet vers Frontend

## ✅ Analyse Complète du Spreadsheet

D'après l'analyse du spreadsheet public, voici le mapping complet:

### Structure des Colonnes

| Colonne | Nom Header | Type | Mapping Frontend |
|---------|------------|------|------------------|
| A | REQUEST # | Number | `number` |
| B | CLIENT NAME | String | (ignoré - nom technique) |
| C | CLIENT NAME | String | `clientName` |
| D | CLIENT E-MAIL | String | (non utilisé pour l'instant) |
| E | CHANNEL | String | `type` (PP si PLUM_*, sinon Client) |
| F | RECEIVED | Date (DD/MM/YYYY) | `date` |
| G | Week received | Number | (non utilisé) |
| H | 3D ARTIST IN CHARGE | String | `assignedTo` (mappé vers artistId) |
| I | STATUS | String | `status` (mappé) |
| J | CONTACT RETARD | String | (non utilisé) |
| K | DRIVE LINK | URL | `ikpLink` |
| L | RENDER # | Number | (non utilisé) |
| M | DATE OF SENDING | Date (DD/MM/YYYY) | (non utilisé) |
| N | WEEK | Number | (non utilisé) |
| O | PRICE | String ($XX) | `price` (converti en nombre) |
| P | SUPPLEMENT | String | `description` |
| Q | INVOICE STATUS | String | (non utilisé) |
| R | COMMENT | String | (ajouté à description si SUPPLEMENT vide) |
| S | RETOUR CLIENT | String | (non utilisé) |
| T | Feedback status | String | (non utilisé) |

### Mapping des Statuts

| Statut Spreadsheet | Statut Frontend | Notes |
|-------------------|----------------|-------|
| "Sent to client" | `sent` | ✅ |
| "Cancelled" | `sent` | Pourrait être un nouveau statut `cancelled` |
| (autres à identifier) | `new`, `ongoing`, `correction` | Selon le contexte |

### Mapping des Artistes

| Artiste Spreadsheet | ID Frontend | Statut |
|---------------------|-------------|--------|
| Xuan 🇻🇳 | `"3"` | ✅ Existe dans artists.json |
| Vitalii 🇺🇦 | `"1"` | ✅ Existe dans artists.json |
| Ahsan 🇱🇰 | `"6"` (temporaire) | ⚠️ N'existe pas - mappé temporairement à Sarabjot |
| Tagyr 🇺🇦 | `null` | ⚠️ N'existe pas - à créer |

**Action requise**: Ajouter Ahsan et Tagyr dans `data/artists.json` ou créer un système de mapping dynamique.

### Détection du Type (PP vs Client)

```typescript
const channel = row[4]; // Colonne E
const type: RequestType = channel.toUpperCase().startsWith('PLUM_') ? 'PP' : 'Client';
```

Exemples:
- `PLUM_FR` → Type: `PP`
- `PLUM_DE` → Type: `PP`
- `PLUM_BE` → Type: `PP`
- `laurent.faraut@eiffage.com` → Type: `Client`

### Parsing des Dates

Format: **DD/MM/YYYY** (ex: `20/11/2024`)

```typescript
function parseDateDDMMYYYY(dateStr: string): string {
  const parts = dateStr.split('/');
  // parts[0] = jour, parts[1] = mois, parts[2] = année
  const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return date.toISOString();
}
```

### Parsing des Prix

Format: **$XX** (ex: `$10`, `$20`, `$30`, `$40`)

```typescript
function parsePrice(priceStr: string): number {
  return parseFloat(priceStr.replace(/[^0-9.]/g, ''));
}
```

## 🔧 Configuration Requise

### 1. Nom de la Feuille Principale

Le système cherche automatiquement une feuille avec:
- Nom contenant "RENDU", "REQUEST", ou "REQUÊTE"
- Ou utilise la première feuille par défaut

D'après le spreadsheet analysé, la feuille principale semble être **"RENDU 3D_REQUEST"**.

### 2. Variables d'Environnement

```env
GOOGLE_SHEETS_ID=17aB2DbGRE29NBJH8Ia__vGeBT8Az2zfIxky-aptC6hw
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account-key.json
```

### 3. Ajout des Artistes Manquants

Mettre à jour `data/artists.json` pour inclure Ahsan et Tagyr:

```json
{
  "id": "8",
  "name": "Ahsan",
  "targetPerWeek": 7,
  "currentWeekCompleted": 0,
  "backlogCount": 0,
  "ongoingCount": 0,
  "sentCount": 0,
  "performanceScore": 0
},
{
  "id": "9",
  "name": "Tagyr",
  "targetPerWeek": 7,
  "currentWeekCompleted": 0,
  "backlogCount": 0,
  "ongoingCount": 0,
  "sentCount": 0,
  "performanceScore": 0
}
```

Puis mettre à jour le mapping dans `lib/google-sheets.ts`:

```typescript
const nameMapping: Record<string, string | null> = {
  'xuan': '3',
  'vitalii': '1',
  'ahsan': '8', // Nouvel ID
  'tagyr': '9', // Nouvel ID
};
```

## 🚀 Test de Synchronisation

Une fois configuré:

1. **Installer googleapis**: `npm install googleapis`
2. **Configurer les credentials** (voir `docs/SETUP_GOOGLE_SHEETS.md`)
3. **Synchroniser**: Cliquer sur "Synchroniser" dans `/admin`
4. **Vérifier les données** dans `data/requests.json` et `data/artists.json`

## 📝 Notes Importantes

1. **Champs non disponibles dans le spreadsheet**:
   - `design` → laissé vide
   - `colors` → laissé vide (objet vide)
   - `thumbnail` → valeur par défaut `/thumbnails/default.jpg`
   - `renders` → tableau vide

2. **Champs supplémentaires dans le spreadsheet** (non mappés pour l'instant):
   - CLIENT E-MAIL
   - Week received
   - RENDER #
   - DATE OF SENDING
   - INVOICE STATUS
   - RETOUR CLIENT
   - Feedback status

3. **Améliorations futures possibles**:
   - Créer un statut `cancelled` pour les requêtes annulées
   - Mapper les champs supplémentaires si nécessaire
   - Ajouter la gestion des renders depuis le DRIVE LINK
   - Synchronisation bidirectionnelle (écriture vers Google Sheets)

