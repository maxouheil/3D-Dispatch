# 🚀 Guide de Démarrage Rapide - Google Sheets

## ✅ Ce qui a été installé et configuré

1. ✅ **googleapis** - Package installé
2. ✅ **Variables d'environnement** - `.env.local` créé avec l'ID du spreadsheet
3. ✅ **Artistes manquants** - Ahsan et Tagyr ajoutés dans `data/artists.json`
4. ✅ **Mapping des artistes** - Mis à jour dans `lib/google-sheets.ts`
5. ✅ **Dossier credentials** - Créé avec README

## 🔧 Étape Finale: Configurer les Credentials Google

Pour que la synchronisation fonctionne, vous devez configurer les credentials Google:

### Option 1: Via Google Cloud Console (Recommandé)

1. **Allez sur** [Google Cloud Console](https://console.cloud.google.com/)

2. **Créez ou sélectionnez un projet**

3. **Activez Google Sheets API**:
   - Menu → APIs & Services → Library
   - Recherchez "Google Sheets API"
   - Cliquez sur "Enable"

4. **Créez un Service Account**:
   - APIs & Services → Credentials
   - Create Credentials → Service Account
   - Donnez un nom (ex: "3d-dispatch-sync")
   - Cliquez sur "Create and Continue" puis "Done"

5. **Générez une clé JSON**:
   - Cliquez sur le service account créé
   - Onglet "Keys" → "Add Key" → "Create new key"
   - Sélectionnez "JSON"
   - Téléchargez le fichier

6. **Placez le fichier**:
   - Renommez-le en `service-account-key.json`
   - Placez-le dans `credentials/service-account-key.json`

7. **Partagez le spreadsheet**:
   - Ouvrez votre Google Spreadsheet
   - Cliquez sur "Share" (Partager)
   - Copiez l'**email du service account** (dans le fichier JSON, champ `client_email`)
   - Collez cet email dans le partage
   - Donnez les permissions **Viewer** (lecture seule)
   - Cliquez sur "Send"

### Option 2: Via Variable d'Environnement (Alternative)

Si vous préférez ne pas utiliser de fichier, vous pouvez mettre le contenu JSON directement dans `.env.local`:

```env
GOOGLE_SERVICE_ACCOUNT_KEY_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

## 🧪 Tester la Configuration

### 1. Vérifier la configuration

```bash
curl http://localhost:3000/api/sheets/sync
```

Vous devriez voir:
```json
{
  "message": "Use POST method to sync data from Google Sheets",
  "config": {
    "spreadsheetId": "Configured",
    "serviceAccountKey": "Configured" ou "Not configured"
  }
}
```

### 2. Synchroniser les données

**Via l'interface:**
1. Démarrez le serveur: `npm run dev`
2. Allez sur `http://localhost:3000/admin`
3. Cliquez sur "Synchroniser" dans le composant Google Sheets Sync

**Via l'API:**
```bash
curl -X POST http://localhost:3000/api/sheets/sync
```

## 📊 Résultat Attendu

Après synchronisation réussie:
- Les données du spreadsheet sont dans `data/requests.json`
- Les artistes sont dans `data/artists.json`
- Le dashboard admin affiche les nouvelles données

## 🐛 Dépannage

### Erreur: "GOOGLE_SHEETS_ID not configured"
- Vérifiez que `.env.local` existe et contient `GOOGLE_SHEETS_ID`

### Erreur: "No service account credentials provided"
- Vérifiez que `credentials/service-account-key.json` existe
- Ou configurez `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` dans `.env.local`

### Erreur: "The caller does not have permission"
- Vérifiez que le spreadsheet est partagé avec l'email du service account
- Vérifiez que Google Sheets API est activée

### Erreur: "Spreadsheet not found"
- Vérifiez que l'ID du spreadsheet est correct dans `.env.local`
- Vérifiez que le service account a accès au spreadsheet

## 💰 Récupération des Prix

### Nouvelle Méthode: Via CSV Typeform (Recommandée)

Pour récupérer les prix des projets, utilisez la nouvelle méthode via CSV Typeform qui contourne les limitations Google Drive :

```bash
# Récupération complète des prix
npx tsx scripts/fetch-prices-from-csv.ts

# Vérifier la progression
npx tsx scripts/check-price-progress.ts
```

**Avantages** :
- ✅ Mapping automatique avec les requests via **NAME + DATE** (~73% de réussite)
- ✅ Connexion automatique à Plum Living
- ✅ Pas de dépendance aux permissions Google Drive

**Documentation complète** : Voir [`docs/PRICE_FETCHING_FROM_CSV.md`](./PRICE_FETCHING_FROM_CSV.md)

## 📚 Documentation Complète

- `docs/SETUP_GOOGLE_SHEETS.md` - Guide détaillé de configuration
- `docs/MAPPING_FINAL.md` - Détails du mapping des colonnes
- `docs/SPREADSHEET_ANALYSIS.md` - Analyse du spreadsheet
- `docs/PRICE_FETCHING_FROM_CSV.md` - Récupération des prix via CSV Typeform

## ✨ Prêt à l'emploi!

Une fois les credentials configurés, vous pouvez synchroniser vos données depuis Google Sheets vers votre application!



