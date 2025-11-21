# Modifications - Page Requests

## ✅ Modifications Effectuées

### 1. Combinaison des Onglets
- La synchronisation lit maintenant **deux onglets** :
  - `Follow up PP`
  - `Follow up client`
- Les données des deux onglets sont **combinées** en une seule liste

### 2. Tri par Date
- Les requêtes sont **triées du plus récent au plus ancien**
- Tri effectué dans `lib/google-sheets-impl.ts` après la combinaison
- Tri également appliqué dans `app/admin/requests/page.tsx` pour garantir l'ordre

### 3. Mapping des Colonnes

| Colonne Frontend | Source Spreadsheet | Détails |
|----------------|-------------------|---------|
| **Request #** | `REQUEST #` (colonne A) | Numéro de requête |
| **Name** | `CLIENT NAME` (colonne C) | Nom réel du client |
| **PP** | `PP email` ou `CLIENT E-MAIL` | **Extraction du prénom uniquement**<br>Ex: `camille.cappucci@plum-living.com` → `Camille` |
| **Status** | `STATUS` (colonne I) | Statut de la requête |
| **Assign to** | `3D ARTIST IN CHARGE` (colonne H) | Artiste assigné |

### 4. Extraction du Prénom PP

Fonction créée : `extractFirstNameFromEmail()`
- Prend un email en entrée
- Extrait la partie avant le `@`
- Prend le premier mot (avant le premier `.`)
- Capitalise la première lettre

**Exemples :**
- `camille.cappucci@plum-living.com` → `Camille`
- `laurent.faraut@eiffage.com` → `Laurent`
- `gaetane.rebuffet@gmail.com` → `Gaetane`

## 📋 Structure des Données

### Mapping Automatique des Colonnes

Le système cherche automatiquement les colonnes par nom (insensible à la casse) :

- `request #` ou `request` → Request #
- `client name` → Client Name
- `pp email` ou `pp e-mail` ou `client e-mail` (si type PP) → PP email
- `status` → Status
- `3d artist in charge` ou `artist` → Assign to
- `received` ou `date` → Date de réception
- `price` → Prix

## 🔄 Flux de Synchronisation

1. **Lister les feuilles** du spreadsheet
2. **Trouver** les onglets "Follow up PP" et "Follow up client"
3. **Lire** les données des deux onglets
4. **Parser** chaque ligne en objet Request
5. **Combiner** les deux listes
6. **Trier** par date (décroissant)
7. **Sauvegarder** dans `data/requests.json`

## 🎯 Résultat

La page `/admin/requests` affiche maintenant :
- ✅ Toutes les requêtes des deux onglets combinées
- ✅ Triées du plus récent au plus ancien
- ✅ Colonnes mappées correctement
- ✅ Prénom PP extrait de l'email

## 📝 Notes

- Si les onglets "Follow up PP" ou "Follow up client" ne sont pas trouvés, le système utilise l'onglet principal par défaut
- Le tri est effectué à la fois lors de la synchronisation et dans le frontend pour garantir l'ordre
- La recherche fonctionne toujours sur les requêtes filtrées

