/**
 * Script simple pour tester l'authentification Google
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testAuth() {
  console.log('🔍 Test d\'authentification Google...\n');

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  console.log(`Spreadsheet ID: ${spreadsheetId}\n`);

  // Charger les credentials
  let credentials: any;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    console.log(`Loading credentials from: ${keyPath}`);
    const keyFile = fs.readFileSync(keyPath, 'utf8');
    credentials = JSON.parse(keyFile);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    console.log('Loading credentials from GOOGLE_SERVICE_ACCOUNT_KEY_JSON');
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
  } else {
    console.error('❌ Aucune configuration de credentials trouvée');
    console.log('Vérifiez que GOOGLE_SERVICE_ACCOUNT_KEY ou GOOGLE_SERVICE_ACCOUNT_KEY_JSON est défini');
    process.exit(1);
  }

  console.log(`Project ID: ${credentials.project_id}`);
  console.log(`Client Email: ${credentials.client_email}\n`);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  try {
    console.log('🔐 Tentative d\'authentification...');
    const authClient = await auth.getClient();
    const projectId = await authClient.getProjectId();
    console.log(`✅ Authentification réussie`);
    console.log(`   Project ID détecté: ${projectId}\n`);

    console.log('📊 Test d\'accès au spreadsheet...');
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId!,
      });
      console.log(`✅ Accès au spreadsheet réussi!`);
      console.log(`   Titre: "${response.data.properties?.title}"`);
      console.log(`   Sheets: ${response.data.sheets?.length || 0} onglets trouvés\n`);
    } catch (error: any) {
      console.log(`❌ Erreur lors de l'accès au spreadsheet:`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Code: ${error.code || 'N/A'}`);
      
      if (error.message.includes('has not been used') || error.message.includes('disabled')) {
        console.log(`\n💡 L'API Google Sheets n'est pas activée pour le projet: ${projectId}`);
        console.log(`   Activez-la ici: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId}`);
      } else if (error.message.includes('permission') || error.message.includes('not found')) {
        console.log(`\n💡 Vérifiez que le spreadsheet est partagé avec: ${credentials.client_email}`);
        console.log(`   Ouvrez le spreadsheet et cliquez sur "Partager", puis ajoutez cet email`);
      }
    }

  } catch (error: any) {
    console.error('❌ Erreur d\'authentification:', error.message);
    if (error.message.includes('project_id')) {
      console.log('\n💡 Le fichier JSON des credentials semble invalide');
    }
  }
}

testAuth().catch(console.error);

