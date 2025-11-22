# 📋 Guide Étape par Étape - Configuration Google Sheets

## 🎯 Objectif
Créer un Service Account pour permettre à votre application de lire les données depuis Google Sheets.

---

## ÉTAPE 1: Activer Google Sheets API

### 1.1 Accéder à la bibliothèque d'APIs

1. Dans le menu de gauche, cliquez sur **"APIs & Services"**
2. Cliquez sur **"Library"** (Bibliothèque)

### 1.2 Rechercher et activer Google Sheets API

1. Dans la barre de recherche en haut, tapez: **"Google Sheets API"**
2. Cliquez sur **"Google Sheets API"** dans les résultats
3. Sur la page qui s'ouvre, cliquez sur le bouton bleu **"ENABLE"** (Activer)
4. Attendez quelques secondes que l'API soit activée

✅ **Vérification**: Vous devriez voir "API enabled" avec une coche verte

---

## ÉTAPE 2: Créer un Service Account

### 2.1 Retourner aux Credentials

1. Dans le menu de gauche, cliquez sur **"Credentials"**
2. Vous êtes maintenant sur la page que vous voyez dans la capture d'écran

### 2.2 Créer le Service Account

1. En haut de la page, cliquez sur le bouton **"+ CREATE CREDENTIALS"** (Créer des identifiants)
2. Dans le menu déroulant, sélectionnez **"Service account"**

### 2.3 Configurer le Service Account

Une nouvelle page s'ouvre avec 3 étapes:

#### Étape 1: Service account details (Détails du compte de service)

1. **Service account name** (Nom du compte de service):
   - Entrez: `3d-dispatch-sheets-reader`
   - Ou un nom de votre choix (ex: `sheets-sync`)

2. **Service account ID**:
   - Se remplit automatiquement (vous pouvez le laisser tel quel)

3. **Service account description** (optionnel):
   - Entrez: `Service account pour synchroniser les données depuis Google Sheets`
   - Ou laissez vide

4. Cliquez sur **"CREATE AND CONTINUE"** (Créer et continuer)

#### Étape 2: Grant this service account access to project (Accorder l'accès)

1. **Role** (Rôle):
   - Vous pouvez laisser vide pour l'instant
   - Ou sélectionner "Viewer" si vous voulez être plus restrictif

2. Cliquez sur **"CONTINUE"** (Continuer)

#### Étape 3: Grant users access to this service account (Accorder l'accès aux utilisateurs)

1. **Laissez vide** (pas nécessaire pour notre cas)
2. Cliquez sur **"DONE"** (Terminé)

✅ **Résultat**: Vous êtes redirigé vers la page Credentials et votre Service Account apparaît dans la section "Service Accounts"

---

## ÉTAPE 3: Créer une Clé JSON

### 3.1 Ouvrir le Service Account

1. Dans la section **"Service Accounts"**, vous devriez voir votre nouveau compte
2. Cliquez sur l'**email** du service account (format: `xxxxx@xxxxx.iam.gserviceaccount.com`)

### 3.2 Créer une clé

1. En haut de la page, cliquez sur l'onglet **"KEYS"** (Clés)
2. Cliquez sur **"ADD KEY"** (Ajouter une clé)
3. Sélectionnez **"Create new key"** (Créer une nouvelle clé)

### 3.3 Télécharger la clé JSON

1. Une popup s'ouvre avec deux options:
   - **JSON** ← Sélectionnez cette option
   - Key type: **JSON** (déjà sélectionné)

2. Cliquez sur **"CREATE"** (Créer)

3. **IMPORTANT**: Un fichier JSON se télécharge automatiquement
   - Le fichier s'appelle quelque chose comme: `3d-dispatch-xxxxx-xxxxx.json`
   - **SAUVEGARDEZ-LE BIEN** - vous ne pourrez plus le télécharger après!

✅ **Résultat**: Vous avez maintenant un fichier JSON avec les credentials

---

## ÉTAPE 4: Placer le Fichier JSON dans le Projet

### 4.1 Renommer le fichier

1. Renommez le fichier téléchargé en: `service-account-key.json`

### 4.2 Placer le fichier

1. Ouvrez le dossier de votre projet: `/Users/sou/Desktop/3D Dispatch`
2. Ouvrez le dossier `credentials/`
3. **Glissez-déposez** le fichier `service-account-key.json` dans ce dossier

✅ **Vérification**: Le chemin complet devrait être:
```
/Users/sou/Desktop/3D Dispatch/credentials/service-account-key.json
```

---

## ÉTAPE 5: Partager le Spreadsheet avec le Service Account

### 5.1 Trouver l'Email du Service Account

1. Ouvrez le fichier `credentials/service-account-key.json`
2. Cherchez la ligne `"client_email"`
3. Copiez la valeur (format: `xxxxx@xxxxx.iam.gserviceaccount.com`)

**Exemple:**
```json
{
  "client_email": "3d-dispatch-sheets-reader@my-project.iam.gserviceaccount.com",
  ...
}
```

### 5.2 Ouvrir le Google Spreadsheet

1. Allez sur: https://docs.google.com/spreadsheets/d/17aB2DbGRE29NBJH8Ia__vGeBT8Az2zfIxky-aptC6hw/edit
2. Ou ouvrez votre spreadsheet depuis Google Drive

### 5.3 Partager le Spreadsheet

1. Cliquez sur le bouton **"Share"** (Partager) en haut à droite
2. Dans le champ "Add people and groups" (Ajouter des personnes et groupes):
   - **Collez l'email du service account** (celui que vous avez copié)
3. À droite de l'email, sélectionnez les permissions:
   - **"Viewer"** (Lecteur) ← Sélectionnez cette option
   - (Vous pouvez aussi mettre "Editor" si vous voulez permettre l'écriture plus tard)
4. **Décochez** "Notify people" (Notifier les personnes) - pas nécessaire pour un service account
5. Cliquez sur **"Share"** (Partager)

✅ **Résultat**: Le service account a maintenant accès au spreadsheet en lecture

---

## ÉTAPE 6: Vérifier la Configuration

### 6.1 Vérifier le fichier .env.local

Le fichier `.env.local` devrait déjà exister avec:
```env
GOOGLE_SHEETS_ID=17aB2DbGRE29NBJH8Ia__vGeBT8Az2zfIxky-aptC6hw
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account-key.json
```

✅ Si le fichier existe et contient ces valeurs, c'est bon!

### 6.2 Vérifier la structure des fichiers

```
/Users/sou/Desktop/3D Dispatch/
├── .env.local                    ✅ (existe)
├── credentials/
│   ├── README.md                 ✅ (existe)
│   └── service-account-key.json ✅ (à créer)
└── ...
```

---

## ÉTAPE 7: Tester la Synchronisation

### 7.1 Démarrer le serveur de développement

```bash
cd "/Users/sou/Desktop/3D Dispatch"
npm run dev
```

### 7.2 Tester via l'interface

1. Ouvrez votre navigateur: http://localhost:3000/admin
2. Vous devriez voir un composant **"Synchronisation Google Sheets"**
3. Cliquez sur le bouton **"Synchroniser"**
4. Attendez quelques secondes...

### 7.3 Résultat attendu

✅ **Succès**: 
- Message vert "Synchronisation réussie"
- Nombre de requêtes et artistes synchronisés
- La page se rafraîchit automatiquement
- Les données apparaissent dans le dashboard

❌ **Erreur**: 
- Message rouge avec le détail de l'erreur
- Consultez la section "Dépannage" ci-dessous

---

## 🐛 Dépannage

### Erreur: "GOOGLE_SHEETS_ID not configured"
- Vérifiez que `.env.local` existe à la racine du projet
- Vérifiez qu'il contient `GOOGLE_SHEETS_ID=17aB2DbGRE29NBJH8Ia__vGeBT8Az2zfIxky-aptC6hw`

### Erreur: "No service account credentials provided"
- Vérifiez que `credentials/service-account-key.json` existe
- Vérifiez que le chemin dans `.env.local` est correct: `./credentials/service-account-key.json`

### Erreur: "The caller does not have permission"
- Vérifiez que le spreadsheet est bien partagé avec l'email du service account
- Vérifiez que les permissions sont au moins "Viewer"
- Attendez quelques minutes après le partage (propagation)

### Erreur: "Spreadsheet not found"
- Vérifiez que l'ID du spreadsheet est correct dans `.env.local`
- Vérifiez que le service account a bien accès au spreadsheet

### Erreur: "API not enabled"
- Retournez dans Google Cloud Console
- APIs & Services → Library
- Recherchez "Google Sheets API"
- Vérifiez qu'elle est activée (bouton "MANAGE" au lieu de "ENABLE")

---

## ✅ Checklist Finale

Avant de tester, vérifiez que:

- [ ] Google Sheets API est activée dans Google Cloud Console
- [ ] Service Account créé dans Google Cloud Console
- [ ] Clé JSON téléchargée et renommée `service-account-key.json`
- [ ] Fichier placé dans `credentials/service-account-key.json`
- [ ] Spreadsheet partagé avec l'email du service account (permissions Viewer)
- [ ] Fichier `.env.local` existe avec `GOOGLE_SHEETS_ID` et `GOOGLE_SERVICE_ACCOUNT_KEY`
- [ ] Serveur de développement démarré (`npm run dev`)

---

## 🎉 C'est Prêt!

Une fois toutes ces étapes complétées, vous pouvez synchroniser vos données depuis Google Sheets vers votre application!

Pour toute question, consultez:
- `docs/QUICK_START.md` - Guide rapide
- `docs/SETUP_GOOGLE_SHEETS.md` - Guide détaillé
- `docs/MAPPING_FINAL.md` - Détails du mapping



