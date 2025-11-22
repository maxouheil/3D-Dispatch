/**
 * Script pour vérifier la progression de la récupération des prix
 * 
 * Usage:
 *   npx tsx scripts/check-price-progress.ts
 */

import fs from 'fs';
import path from 'path';
import { parseBothTypeformCSVs } from '../lib/typeform-csv-parser';

const downloadsPath = path.join(process.env.HOME || '/Users/sou', 'Downloads');
const logPath = '/tmp/fetch-prices.log';

function findTypeformCSVs(): { ppCsv?: string; clientCsv?: string } {
  if (!fs.existsSync(downloadsPath)) {
    return {};
  }

  const files = fs.readdirSync(downloadsPath);
  const ppCsv = files.find(f => f.includes('a25xCDxH'));
  const clientCsv = files.find(f => f.includes('oIygOgih'));

  return {
    ppCsv: ppCsv ? path.join(downloadsPath, ppCsv) : undefined,
    clientCsv: clientCsv ? path.join(downloadsPath, clientCsv) : undefined,
  };
}

async function main() {
  console.log('📊 Vérification de la progression de la récupération des prix\n');

  // Compter le nombre total de projets
  const csvFiles = findTypeformCSVs();
  if (!csvFiles.ppCsv && !csvFiles.clientCsv) {
    console.error('❌ Aucun fichier CSV Typeform trouvé');
    return;
  }

  const parseResult = parseBothTypeformCSVs(csvFiles.ppCsv, csvFiles.clientCsv);
  console.log(`📋 Total projets à traiter: ${parseResult.stats.total}`);
  console.log(`   - PP: ${parseResult.stats.pp}`);
  console.log(`   - Client: ${parseResult.stats.client}\n`);

  // Vérifier le log si disponible
  if (fs.existsSync(logPath)) {
    const logContent = fs.readFileSync(logPath, 'utf-8');
    const lines = logContent.split('\n');
    
    // Compter les prix récupérés
    const fetchedCount = (logContent.match(/Found total price:/g) || []).length;
    const errorCount = (logContent.match(/Price element not found|Failed to log in/g) || []).length;
    const loginCount = (logContent.match(/Successfully logged in/g) || []).length;
    
    console.log(`📈 Progression:`);
    console.log(`   - Prix récupérés: ${fetchedCount}`);
    console.log(`   - Connexions réussies: ${loginCount}`);
    console.log(`   - Erreurs: ${errorCount}`);
    console.log(`   - Progression: ${((fetchedCount / parseResult.stats.total) * 100).toFixed(1)}%\n`);
    
    // Afficher les dernières lignes
    console.log(`📝 Dernières lignes du log:`);
    lines.slice(-10).forEach(line => {
      if (line.trim()) {
        console.log(`   ${line}`);
      }
    });
  } else {
    console.log('⚠️  Fichier de log non trouvé. Le processus peut ne pas avoir démarré.');
  }
}

main().catch(console.error);


