# Guide de Configuration Google Sheets

## 📋 Prérequis

1. Un compte Google avec accès à Google Sheets
2. Un Google Spreadsheet avec vos données
3. Node.js et npm installés

## 🔧 Configuration Étape par Étape

### Étape 1: Créer un Projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Notez le **Project ID**

### Étape 2: Activer Google Sheets API

1. Dans Google Cloud Console, allez dans **APIs & Services** > **Library**
2. Recherchez "Google Sheets API"
3. Cliquez sur **Enable**

### Étape 3: Créer un Service Account

1. Allez dans **APIs & Services** > **Credentials**
2. Cliquez sur **Create Credentials** > **Service Account**
3. Donnez un nom au service account (ex: "3d-dispatch-sync")
4. Cliquez sur **Create and Continue**
5. Optionnel: Ajoutez un rôle (peut être laissé vide)
6. Cliquez sur **Done**

### Étape 4: Générer une Clé JSON

1. Dans la liste des Service Accounts, cliquez sur celui que vous venez de créer
2. Allez dans l'onglet **Keys**
3. Cliquez sur **Add Key** > **Create new key**
4. Sélectionnez **JSON**
5. Téléchargez le fichier JSON
6. **IMPORTANT:** Gardez ce fichier secret et ne le commitez jamais dans Git

### Étape 5: Partager le Spreadsheet

1. Ouvrez votre Google Spreadsheet
2. Cliquez sur **Share** (Partager)
3. Copiez l'**email du service account** (format: `xxxxx@xxxxx.iam.gserviceaccount.com`)
4. Collez cet email dans le champ de partage
5. Donnez les permissions **Viewer** (lecture seule) ou **Editor** (si vous voulez écrire)
6. Cliquez sur **Send**

### Étape 6: Obtenir l'ID du Spreadsheet

L'ID se trouve dans l'URL du spreadsheet:
```
https://docs.google.com/spreadsheets/d/1LzZY_4-I6-w9YvUCgYQKkjNGIfHMwE25K1N-Z9IiAsE/edit
                                                      ↑
                                              C'est l'ID ici
```

Dans cet exemple: `1LzZY_4-I6-w9YvUCgYQKkjNGIfHMwE25K1N-Z9IiAsE`

### Étape 7: Installer les Dépendances

```bash
npm install googleapis
```

### Étape 8: Configurer les Variables d'Environnement

Créez un fichier `.env.local` à la racine du projet:

```env
# ID du Google Spreadsheet
GOOGLE_SHEETS_ID=1LzZY_4-I6-w9YvUCgYQKkjNGIfHMwE25K1N-Z9IiAsE

# Chemin vers le fichier JSON du service account
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account-key.json
```

**Alternative:** Vous pouvez aussi mettre le contenu JSON directement dans une variable:

```env
GOOGLE_SERVICE_ACCOUNT_KEY_JSON='{"type":"service_account","project_id":"..."}'
```

### Étape 9: Structure du Spreadsheet

Votre spreadsheet doit avoir au moins deux feuilles:

#### Feuille "Requests" (ou "Requêtes")
Colonnes attendues (peuvent être dans n'importe quel ordre):
- `ID` ou `id`
- `Number` ou `number`
- `Client Name` ou `client name`
- `Type` ou `type` (PP ou Client)
- `Date` ou `date`
- `Status` ou `status` (new, ongoing, correction, sent)
- `Assigned To` ou `assigned to`
- `Price` ou `price`
- `IKP Link` ou `ikp link`
- `Design` ou `design`
- `Colors Haut` ou `colors haut` (optionnel)
- `Colors Bas` ou `colors bas` (optionnel)
- `Colors Colonne` ou `colors colonne` (optionnel)
- `Description` ou `description`
- `Thumbnail` ou `thumbnail`

#### Feuille "Artists" (ou "Artistes")
Colonnes attendues:
- `ID` ou `id`
- `Name` ou `name`
- `Target Per Week` ou `target per week`
- `Current Week Completed` ou `current week completed`
- `Backlog Count` ou `backlog count`
- `Ongoing Count` ou `ongoing count`
- `Sent Count` ou `sent count`
- `Performance Score` ou `performance score`

## 🚀 Utilisation

### Synchronisation Manuelle

Depuis le frontend ou via une requête API:

```typescript
// Synchroniser les données
const response = await fetch('/api/sheets/sync', {
  method: 'POST',
});

const result = await response.json();
console.log(result);
```

### Synchronisation Automatique

Vous pouvez créer un cron job ou un webhook pour synchroniser automatiquement.

## 🔒 Sécurité

1. **Ne commitez jamais** le fichier JSON du service account
2. Ajoutez `credentials/` dans `.gitignore`
3. Utilisez des variables d'environnement pour les secrets
4. Limitez les permissions du service account au strict nécessaire

## 🐛 Dépannage

### Erreur: "The caller does not have permission"
- Vérifiez que le spreadsheet est bien partagé avec l'email du service account
- Vérifiez que Google Sheets API est activée

### Erreur: "Spreadsheet not found"
- Vérifiez que l'ID du spreadsheet est correct
- Vérifiez que le service account a accès au spreadsheet

### Erreur: "Invalid credentials"
- Vérifiez que le chemin vers le fichier JSON est correct
- Vérifiez que le fichier JSON est valide

## 📚 Ressources

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Google APIs Node.js Client](https://github.com/googleapis/google-api-nodejs-client)
- [Service Accounts Guide](https://cloud.google.com/iam/docs/service-accounts)



