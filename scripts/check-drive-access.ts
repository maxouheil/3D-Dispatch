/**
 * Script pour vérifier l'accès du service account aux dossiers Drive
 * 
 * Usage:
 *   npx tsx scripts/check-drive-access.ts
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

async function checkDriveAccess() {
  console.log('🔍 Vérification de l\'accès Drive...\n');

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

  // Test avec le dossier parent
  const parentFolderId = '1f76_mJOL6V-Z5LdQGdW5zvai8yr7E3HW';
  
  console.log(`📁 Test d'accès au dossier parent: ${parentFolderId}\n`);

  try {
    // Essayer de lister les fichiers dans le dossier parent
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 10,
    });

    const files = response.data.files || [];
    
    if (files.length > 0) {
      console.log(`✅ Accès réussi ! ${files.length} fichiers/dossiers trouvés:\n`);
      files.forEach((file: any, index: number) => {
        const type = file.mimeType === 'application/vnd.google-apps.folder' ? '📁 Dossier' : '📄 Fichier';
        console.log(`  ${index + 1}. ${type}: ${file.name}`);
        if (file.mimeType === 'application/vnd.google-apps.document') {
          console.log(`     → Google Doc trouvé ! (ID: ${file.id})`);
        }
      });
      console.log('\n✅ Le service account a bien accès au dossier parent !');
    } else {
      console.log('⚠️  Aucun fichier trouvé dans le dossier parent.');
      console.log('   Cela peut signifier que le dossier est vide ou que l\'accès n\'est pas encore effectif.');
    }

    // Chercher spécifiquement des Google Docs
    const docsResponse = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 5,
    });

    const docs = docsResponse.data.files || [];
    if (docs.length > 0) {
      console.log(`\n📄 Google Docs trouvés directement dans le dossier parent: ${docs.length}`);
      docs.forEach((doc: any, index: number) => {
        console.log(`  ${index + 1}. ${doc.name} (ID: ${doc.id})`);
      });
    }

  } catch (error: any) {
    if (error.code === 403) {
      console.error('❌ Erreur 403: Accès refusé');
      console.error('\n📋 Actions à faire:');
      console.error('1. Ouvrir le dossier parent: https://drive.google.com/drive/folders/' + parentFolderId);
      console.error('2. Cliquer sur "Partager"');
      console.error('3. Ajouter l\'email: id-d-dispatch-sheets-reader@d-dispatch-478910.iam.gserviceaccount.com');
      console.error('4. Donner l\'accès "Lecteur"');
      console.error('5. Cliquer sur "Envoyer"');
    } else {
      console.error('❌ Erreur:', error.message);
    }
    process.exit(1);
  }
}

checkDriveAccess().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});



