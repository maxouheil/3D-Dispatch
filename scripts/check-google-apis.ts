/**
 * Script pour diagnostiquer les problèmes d'API Google
 * 
 * Usage:
 *   npx tsx scripts/check-google-apis.ts
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

async function checkGoogleAPIs() {
  console.log('🔍 Diagnostic des APIs Google...\n');

  // Charger la configuration
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    console.error('❌ GOOGLE_SHEETS_ID not configured');
    process.exit(1);
  }

  let credentials: any;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const keyFile = fs.readFileSync(keyPath, 'utf8');
    credentials = JSON.parse(keyFile);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
  } else {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_JSON must be configured');
    process.exit(1);
  }

  console.log('📋 Informations du Service Account:');
  console.log(`   Project ID: ${credentials.project_id}`);
  console.log(`   Client Email: ${credentials.client_email}`);
  console.log(`   Type: ${credentials.type}\n`);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  try {
    const authClient = await auth.getClient();
    const projectId = await authClient.getProjectId();
    
    console.log('✅ Authentification réussie');
    console.log(`   Project ID détecté: ${projectId}\n`);

    // Tester Google Sheets API
    console.log('📊 Test de Google Sheets API...');
    try {
      const sheets = google.sheets({ version: 'v4', auth: authClient });
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      console.log(`   ✅ Google Sheets API fonctionne`);
      console.log(`   📄 Spreadsheet: "${response.data.properties?.title}"`);
    } catch (error: any) {
      console.log(`   ❌ Erreur Google Sheets API:`);
      console.log(`      ${error.message}`);
      if (error.message.includes('has not been used') || error.message.includes('disabled')) {
        console.log(`\n   💡 Solution:`);
        console.log(`      Activez Google Sheets API pour le projet: ${projectId}`);
        console.log(`      Lien: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId}`);
      }
    }

    // Tester Google Drive API
    console.log('\n📁 Test de Google Drive API...');
    try {
      const drive = google.drive({ version: 'v3', auth: authClient });
      await drive.files.get({
        fileId: spreadsheetId,
      });
      console.log(`   ✅ Google Drive API fonctionne`);
    } catch (error: any) {
      console.log(`   ❌ Erreur Google Drive API:`);
      console.log(`      ${error.message}`);
      if (error.message.includes('has not been used') || error.message.includes('disabled')) {
        console.log(`\n   💡 Solution:`);
        console.log(`      Activez Google Drive API pour le projet: ${projectId}`);
        console.log(`      Lien: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`);
      }
    }

    console.log('\n📝 Résumé:');
    console.log(`   Project ID dans les credentials: ${credentials.project_id}`);
    console.log(`   Project ID détecté: ${projectId}`);
    
    if (credentials.project_id !== projectId) {
      console.log(`   ⚠️  ATTENTION: Les project IDs ne correspondent pas!`);
      console.log(`      Cela peut causer des problèmes.`);
    }

    console.log('\n🔗 Liens pour activer les APIs:');
    console.log(`   Google Sheets API: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId}`);
    console.log(`   Google Drive API: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`);

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'authentification:', error.message);
    if (error.message.includes('project_id')) {
      console.log('\n💡 Vérifiez que le fichier JSON des credentials est valide.');
    }
  }
}

checkGoogleAPIs().catch(console.error);

