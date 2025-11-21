# 🔧 Activation des APIs Google - Instructions

## ⚠️ Problème identifié

Vos credentials utilisent le projet: **`d-dispatch-478910`**
Mais les APIs sont peut-être activées dans un autre projet.

## ✅ Solution: Activer les APIs dans le bon projet

### 1. Activer Google Sheets API

**Lien direct:**
```
https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=d-dispatch-478910
```

**Ou manuellement:**
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. **Sélectionnez le projet `d-dispatch-478910`** (en haut à gauche)
3. Menu → **APIs & Services** → **Library**
4. Recherchez **"Google Sheets API"**
5. Cliquez sur **"Enable"**

### 2. Activer Google Drive API

**Lien direct:**
```
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=d-dispatch-478910
```

**Ou manuellement:**
1. Dans le même projet `d-dispatch-478910`
2. Menu → **APIs & Services** → **Library**
3. Recherchez **"Google Drive API"**
4. Cliquez sur **"Enable"**

### 3. Vérifier l'activation

1. Menu → **APIs & Services** → **Enabled APIs**
2. Vous devriez voir:
   - ✅ Google Sheets API
   - ✅ Google Drive API

### 4. Attendre 2-5 minutes

Après activation, attendez quelques minutes pour la propagation.

### 5. Réessayer la synchronisation

Retournez dans l'interface admin et relancez la synchronisation.

---

## 📋 Informations de votre configuration

- **Project ID:** `d-dispatch-478910`
- **Service Account Email:** `id-d-dispatch-sheets-reader@d-dispatch-478910.iam.gserviceaccount.com`
- **Spreadsheet ID:** (vérifiez dans `.env.local`)

## 🔗 Liens rapides

- [Google Sheets API - Projet d-dispatch-478910](https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=d-dispatch-478910)
- [Google Drive API - Projet d-dispatch-478910](https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=d-dispatch-478910)
- [Liste des APIs activées](https://console.developers.google.com/apis/dashboard?project=d-dispatch-478910)

