/**
 * Script pour créer un mapping entre les anciens IDs de dossiers Drive (organisation)
 * et les nouveaux IDs après duplication dans le Drive personnel
 * 
 * Usage:
 *   1. Dupliquer le dossier parent dans votre Drive personnel
 *   2. Partager le dossier dupliqué avec le service account
 *   3. Exécuter ce script pour créer le mapping
 *   4. Le mapping sera sauvegardé dans data/drive-folder-mapping.json
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

interface FolderMapping {
  [oldFolderId: string]: string; // oldId -> newId
}

async function createFolderMapping() {
  console.log('🗺️  Création du mapping des dossiers Drive...\n');

  // Charger la configuration
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    console.error('❌ GOOGLE_SHEETS_ID not configured');
    process.exit(1);
  }

  let credentials: object;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const keyFile = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'utf8');
    credentials = JSON.parse(keyFile);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
  } else {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_JSON must be configured');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  // Lire les requests pour obtenir tous les IDs de dossiers
  const requestsPath = path.join(process.cwd(), 'data', 'requests.json');
  if (!fs.existsSync(requestsPath)) {
    console.error('❌ Fichier requests.json non trouvé');
    process.exit(1);
  }

  const requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
  const folderIds = new Set<string>();

  requests.forEach((req: any) => {
    if (req.ikpLink && req.ikpLink.trim()) {
      // Extraire l'ID du dossier depuis le lien
      const match = req.ikpLink.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (match) {
        folderIds.add(match[1]);
      }
    }
  });

  console.log(`📁 ${folderIds.size} dossiers uniques trouvés dans les requests\n`);

  // Demander l'ID du nouveau dossier parent (dupliqué)
  console.log('📋 Pour créer le mapping:');
  console.log('1. Dupliquez le dossier parent dans votre Drive personnel');
  console.log('2. Partagez-le avec le service account');
  console.log('3. Ouvrez le dossier dupliqué et copiez son ID depuis l\'URL');
  console.log('   Exemple: https://drive.google.com/drive/folders/NOUVEAU_ID_ICI\n');
  
  // Pour l'instant, on va créer un mapping vide que l'utilisateur pourra remplir
  const mapping: FolderMapping = {};

  // Sauvegarder le mapping
  const mappingPath = path.join(process.cwd(), 'data', 'drive-folder-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

  console.log(`✅ Fichier de mapping créé: ${mappingPath}`);
  console.log('\n📝 Pour utiliser le mapping:');
  console.log('1. Éditez le fichier data/drive-folder-mapping.json');
  console.log('2. Ajoutez les correspondances: "ancien_id": "nouveau_id"');
  console.log('3. Le code utilisera automatiquement les nouveaux IDs');
}

createFolderMapping().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

