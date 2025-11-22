/**
 * Script de test pour vérifier la récupération des codes projets et prix depuis CSV Typeform
 * 
 * Teste avec 3-4 projets pour vérifier:
 * 1. Le parsing des CSV Typeform
 * 2. L'extraction des codes projets
 * 3. La récupération des prix depuis Plum Living
 * 
 * Usage:
 *   npx tsx scripts/test-csv-price-fetcher.ts
 */

import fs from 'fs';
import path from 'path';
import { parseBothTypeformCSVs } from '../lib/typeform-csv-parser';
import { fetchPriceFromPlumLiving } from '../lib/price-fetcher';

const downloadsPath = path.join(process.env.HOME || '/Users/sou', 'Downloads');

/**
 * Trouve les fichiers CSV Typeform dans le dossier Downloads
 */
function findTypeformCSVs(): { ppCsv?: string; clientCsv?: string } {
  if (!fs.existsSync(downloadsPath)) {
    return {};
  }

  const files = fs.readdirSync(downloadsPath);
  
  // Chercher spécifiquement les fichiers avec les IDs connus
  const ppCsv = files.find(f => f.includes('a25xCDxH'));
  const clientCsv = files.find(f => f.includes('oIygOgih'));

  return {
    ppCsv: ppCsv ? path.join(downloadsPath, ppCsv) : undefined,
    clientCsv: clientCsv ? path.join(downloadsPath, clientCsv) : undefined,
  };
}

async function main() {
  console.log('🧪 Test de récupération des codes projets et prix depuis CSV Typeform\n');

  // Trouver les CSV
  const csvFiles = findTypeformCSVs();
  
  if (!csvFiles.ppCsv && !csvFiles.clientCsv) {
    console.error('❌ Aucun fichier CSV Typeform trouvé dans Downloads');
    console.error(`   Chemin recherché: ${downloadsPath}`);
    process.exit(1);
  }

  console.log('📄 Fichiers CSV trouvés:');
  if (csvFiles.ppCsv) {
    console.log(`   PP: ${csvFiles.ppCsv}`);
  }
  if (csvFiles.clientCsv) {
    console.log(`   Client: ${csvFiles.clientCsv}`);
  }
  console.log('');

  try {
    // Parser les CSV
    console.log('📊 Parsing des CSV Typeform...');
    const parseResult = parseBothTypeformCSVs(csvFiles.ppCsv, csvFiles.clientCsv);
    
    console.log(`✅ ${parseResult.stats.total} projets trouvés:`);
    console.log(`   - PP: ${parseResult.stats.pp}`);
    console.log(`   - Client: ${parseResult.stats.client}`);
    console.log(`   - Avec prix existants: ${parseResult.stats.withPrice}\n`);

    if (parseResult.projects.size === 0) {
      console.error('❌ Aucun projet trouvé dans les CSV');
      process.exit(1);
    }

    // Sélectionner 2 projets pour le test (1 PP et 1 Client pour aller plus vite)
    const projectsArray = Array.from(parseResult.projects.entries());
    const ppProjects = projectsArray.filter(([_, data]) => data.type === 'PP').slice(0, 1);
    const clientProjects = projectsArray.filter(([_, data]) => data.type === 'Client').slice(0, 1);
    const testProjects = [...ppProjects, ...clientProjects];

    console.log(`🔍 Test avec ${testProjects.length} projets:\n`);

    // Tester chaque projet
    const results: Array<{
      projectCode: string;
      type: 'PP' | 'Client';
      existingPrice?: number;
      fetchedPrice: number;
      success: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < testProjects.length; i++) {
      const [projectCode, data] = testProjects[i];
      
      console.log(`\n[${i + 1}/${testProjects.length}] Test du projet: ${projectCode}`);
      console.log(`   Type: ${data.type}`);
      if (data.price) {
        console.log(`   Prix existant dans CSV: €${data.price}`);
      }
      if (data.email) {
        console.log(`   Email: ${data.email}`);
      }

      try {
        console.log(`   🌐 Récupération du prix depuis Plum Living...`);
        const price = await fetchPriceFromPlumLiving(projectCode);

        if (price > 0) {
          console.log(`   ✅ Prix récupéré: €${price}`);
          results.push({
            projectCode,
            type: data.type,
            existingPrice: data.price,
            fetchedPrice: price,
            success: true,
          });
        } else {
          console.log(`   ⚠️  Prix non trouvé ou égal à 0`);
          results.push({
            projectCode,
            type: data.type,
            existingPrice: data.price,
            fetchedPrice: 0,
            success: false,
            error: 'Price not found or equals 0',
          });
        }
      } catch (error: any) {
        console.error(`   ❌ Erreur: ${error.message}`);
        results.push({
          projectCode,
          type: data.type,
          existingPrice: data.price,
          fetchedPrice: 0,
          success: false,
          error: error.message,
        });
      }

      // Délai entre les requêtes
      if (i < testProjects.length - 1) {
        console.log(`   ⏳ Attente de 2 secondes avant le prochain test...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Résumé
    console.log('\n\n📊 Résumé des tests:\n');
    console.log('┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Code Projet                          │ Type   │ Prix CSV │ Prix Site │ Status │');
    console.log('├─────────────────────────────────────────────────────────────────────────┤');

    results.forEach(({ projectCode, type, existingPrice, fetchedPrice, success, error }) => {
      const priceCsvStr = existingPrice ? `€${existingPrice}` : 'N/A';
      const priceSiteStr = fetchedPrice > 0 ? `€${fetchedPrice}` : 'N/A';
      const status = success ? '✅ OK' : `❌ ${error || 'Failed'}`;
      const projectCodeShort = projectCode.length > 35 ? projectCode.substring(0, 32) + '...' : projectCode;
      
      console.log(
        `│ ${projectCodeShort.padEnd(36)} │ ${type.padEnd(5)} │ ${priceCsvStr.padEnd(8)} │ ${priceSiteStr.padEnd(9)} │ ${status.padEnd(6)} │`
      );
    });

    console.log('└─────────────────────────────────────────────────────────────────────────┘');

    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    console.log(`\n✅ ${successCount}/${totalCount} tests réussis`);

    // Détails supplémentaires
    console.log('\n📋 Détails:');
    results.forEach(({ projectCode, type, existingPrice, fetchedPrice, success }) => {
      console.log(`\n   ${projectCode} (${type}):`);
      console.log(`     - Code projet: ✅ ${projectCode}`);
      if (existingPrice) {
        console.log(`     - Prix CSV: €${existingPrice}`);
      }
      if (success) {
        console.log(`     - Prix Plum Living: ✅ €${fetchedPrice}`);
      } else {
        console.log(`     - Prix Plum Living: ❌ Non récupéré`);
      }
    });

    if (successCount === totalCount) {
      console.log('\n🎉 Tous les tests sont passés!');
      console.log('   ✅ Les codes projets sont bien extraits des CSV');
      console.log('   ✅ Les prix sont bien récupérés depuis Plum Living');
      process.exit(0);
    } else {
      console.log('\n⚠️  Certains tests ont échoué.');
      console.log('   Vérifiez les logs ci-dessus pour plus de détails.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Erreur fatale:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Exécuter le script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

