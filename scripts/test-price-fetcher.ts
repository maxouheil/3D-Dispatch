/**
 * Script de test pour la récupération des prix
 * 
 * Teste la récupération des prix sur 3-4 requests spécifiques
 * 
 * Usage:
 *   npx tsx scripts/test-price-fetcher.ts
 * 
 * Ou avec ts-node (si installé):
 *   npx ts-node scripts/test-price-fetcher.ts
 * 
 * Note: Assurez-vous d'avoir les variables d'environnement configurées:
 *   - GOOGLE_SHEETS_ID
 *   - GOOGLE_SERVICE_ACCOUNT_KEY ou GOOGLE_SERVICE_ACCOUNT_KEY_JSON
 */

import fs from 'fs';
import path from 'path';
import { Request } from '../lib/types';
import { fetchPriceFromDriveLink } from '../lib/price-fetcher';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');

interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountKeyPath?: string;
  serviceAccountKey?: object;
  serviceAccountKeyJson?: string;
}

async function main() {
  console.log('🧪 Test de récupération des prix\n');

  // Charger la configuration
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    console.error('❌ GOOGLE_SHEETS_ID not configured');
    process.exit(1);
  }

  const config: GoogleSheetsConfig = {
    spreadsheetId,
  };

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    config.serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    config.serviceAccountKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  } else {
    console.error(
      '❌ GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_JSON must be configured'
    );
    process.exit(1);
  }

  // Charger les requests
  if (!fs.existsSync(requestsPath)) {
    console.error(`❌ Requests file not found: ${requestsPath}`);
    process.exit(1);
  }

  const requestsData = fs.readFileSync(requestsPath, 'utf8');
  const requests: Request[] = JSON.parse(requestsData);

  // Sélectionner 3-4 requests pour les tests
  // Priorité: requests avec ikpLink non vide
  const requestsWithLinks = requests.filter(
    (r) => r.ikpLink && r.ikpLink.trim()
  );

  if (requestsWithLinks.length === 0) {
    console.error('❌ No requests with drive links found');
    console.log('💡 Make sure to sync from Google Sheets first');
    process.exit(1);
  }

  // Sélectionner un mix de PP et Client requests
  const ppRequests = requestsWithLinks.filter((r) => r.type === 'PP').slice(0, 2);
  const clientRequests = requestsWithLinks
    .filter((r) => r.type === 'Client')
    .slice(0, 2);

  const testRequests = [...ppRequests, ...clientRequests].slice(0, 4);

  console.log(`📋 Testing ${testRequests.length} requests:\n`);
  testRequests.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.id} (${r.type}) - ${r.clientName} - Drive: ${r.ikpLink.substring(0, 50)}...`
    );
  });
  console.log('');

  // Tester chaque request
  const results: Array<{
    request: Request;
    success: boolean;
    price: number;
    error?: string;
  }> = [];

  for (let i = 0; i < testRequests.length; i++) {
    const request = testRequests[i];
    console.log(
      `\n[${i + 1}/${testRequests.length}] Testing ${request.id} (${request.type})...`
    );
    console.log(`  Drive Link: ${request.ikpLink}`);

    try {
      const price = await fetchPriceFromDriveLink(
        request.ikpLink,
        request.type,
        config
      );

      if (price > 0) {
        console.log(`  ✅ Price found: ${price}`);
        results.push({ request, success: true, price });
      } else {
        console.log(`  ⚠️  Price not found or error occurred`);
        results.push({
          request,
          success: false,
          price: 0,
          error: 'Price not found',
        });
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      results.push({
        request,
        success: false,
        price: 0,
        error: error.message,
      });
    }

    // Délai entre les requêtes pour éviter le rate limiting
    if (i < testRequests.length - 1) {
      console.log('  ⏳ Waiting 2 seconds before next request...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Résumé
  console.log('\n\n📊 Résumé des tests:\n');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ Request ID        │ Type   │ Price  │ Status                │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  results.forEach(({ request, success, price, error }) => {
    const status = success
      ? '✅ Success'
      : `❌ ${error || 'Failed'}`;
    const priceStr = price > 0 ? `€${price}` : 'N/A';
    console.log(
      `│ ${request.id.padEnd(17)} │ ${request.type.padEnd(5)} │ ${priceStr.padEnd(6)} │ ${status.padEnd(21)} │`
    );
  });

  console.log('└─────────────────────────────────────────────────────────────┘');

  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  console.log(`\n✅ ${successCount}/${totalCount} tests réussis`);

  if (successCount === totalCount) {
    console.log('🎉 Tous les tests sont passés!');
    process.exit(0);
  } else {
    console.log('⚠️  Certains tests ont échoué. Vérifiez les logs ci-dessus.');
    process.exit(1);
  }
}

// Exécuter le script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

