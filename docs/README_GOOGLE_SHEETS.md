# Intégration Google Sheets - Résumé

## ✅ Ce qui a été créé

### 1. Documentation
- **`GOOGLE_SHEETS_INTEGRATION.md`** - Analyse complète de l'intégration
- **`SETUP_GOOGLE_SHEETS.md`** - Guide de configuration étape par étape
- **`ANALYSE_SPREADSHEET.md`** - Guide pour analyser votre spreadsheet spécifique

### 2. Code Source

#### Services
- **`lib/google-sheets.ts`** - Service de parsing et mapping des données
- **`lib/google-sheets-impl.ts`** - Implémentation complète avec googleapis

#### API Routes
- **`app/api/sheets/sync/route.ts`** - Endpoint pour synchroniser les données

#### Composants React
- **`components/admin/GoogleSheetsSync.tsx`** - Composant UI pour déclencher la synchronisation

### 3. Configuration
- **`.gitignore`** - Mis à jour pour exclure les credentials

## 🚀 Installation et Configuration

### Étape 1: Installer googleapis

```bash
npm install googleapis
```

### Étape 2: Configurer Google Cloud

Suivez le guide dans `docs/SETUP_GOOGLE_SHEETS.md` pour:
1. Créer un projet Google Cloud
2. Activer Google Sheets API
3. Créer un Service Account
4. Télécharger la clé JSON

### Étape 3: Configurer les Variables d'Environnement

Créez un fichier `.env.local`:

```env
GOOGLE_SHEETS_ID=1LzZY_4-I6-w9YvUCgYQKkjNGIfHMwE25K1N-Z9IiAsE
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account-key.json
```

Ou avec le JSON directement:

```env
GOOGLE_SHEETS_ID=1LzZY_4-I6-w9YvUCgYQKkjNGIfHMwE25K1N-Z9IiAsE
GOOGLE_SERVICE_ACCOUNT_KEY_JSON='{"type":"service_account",...}'
```

### Étape 4: Partager le Spreadsheet

Partagez votre Google Spreadsheet avec l'email du service account (format: `xxxxx@xxxxx.iam.gserviceaccount.com`)

## 📊 Structure du Spreadsheet

Le système attend deux feuilles:

### Feuille "Requests" (ou "Requêtes")
Colonnes attendues (auto-détectées par nom):
- ID, Number, Client Name, Type, Date, Status, Assigned To, Price, IKP Link, Design, Colors Haut, Colors Bas, Colors Colonne, Description, Thumbnail

### Feuille "Artists" (ou "Artistes")
Colonnes attendues:
- ID, Name, Target Per Week, Current Week Completed, Backlog Count, Ongoing Count, Sent Count, Performance Score

**Note**: Les noms de colonnes sont insensibles à la casse et les espaces sont ignorés.

## 🎯 Utilisation

### Synchronisation Manuelle

1. **Via l'interface admin**: 
   - Allez sur `/admin`
   - Cliquez sur "Synchroniser" dans le composant Google Sheets Sync
   - Les données seront synchronisées et la page se rafraîchira

2. **Via l'API**:
   ```bash
   curl -X POST http://localhost:3000/api/sheets/sync
   ```

### Synchronisation Automatique (Optionnel)

Vous pouvez créer un cron job ou un webhook pour synchroniser automatiquement. Voir `docs/SETUP_GOOGLE_SHEETS.md` pour plus de détails.

## 🔧 Personnalisation

Si votre spreadsheet utilise des noms de colonnes différents:

1. **Option 1**: Renommez les colonnes dans le spreadsheet pour correspondre aux noms attendus
2. **Option 2**: Modifiez les fonctions `mapRowToRequest` et `mapRowToArtist` dans `lib/google-sheets.ts`

## 📝 Prochaines Étapes

Pour finaliser l'intégration avec votre spreadsheet spécifique:

1. **Partagez la structure de votre spreadsheet**:
   - Noms des feuilles
   - Noms des colonnes (première ligne)
   - Exemples de données

2. **Je personnaliserai le mapping** si nécessaire

3. **Testez la synchronisation** une fois configurée

## 🐛 Dépannage

### Erreur: "googleapis package not installed"
```bash
npm install googleapis
```

### Erreur: "GOOGLE_SHEETS_ID not configured"
Vérifiez que `.env.local` contient `GOOGLE_SHEETS_ID`

### Erreur: "The caller does not have permission"
- Vérifiez que le spreadsheet est partagé avec l'email du service account
- Vérifiez que Google Sheets API est activée dans Google Cloud Console

### Les données ne se synchronisent pas correctement
- Vérifiez les noms des colonnes dans votre spreadsheet
- Vérifiez les noms des feuilles ("Requests" et "Artists")
- Consultez les logs du serveur pour plus de détails

## 📚 Documentation Complémentaire

- `docs/GOOGLE_SHEETS_INTEGRATION.md` - Analyse détaillée
- `docs/SETUP_GOOGLE_SHEETS.md` - Guide de configuration
- `docs/ANALYSE_SPREADSHEET.md` - Guide d'analyse du spreadsheet

## 💡 Notes

- Le système utilise actuellement des fichiers JSON locaux comme cache
- Les données sont synchronisées depuis Google Sheets vers les fichiers JSON
- Les modifications dans le frontend ne sont pas encore synchronisées vers Google Sheets (écriture unidirectionnelle pour l'instant)
- Pour une synchronisation bidirectionnelle, il faudrait implémenter l'écriture vers Google Sheets

