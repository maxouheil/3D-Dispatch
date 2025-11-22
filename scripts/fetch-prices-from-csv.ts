/**
 * Script pour récupérer les prix depuis les CSV Typeform
 * 
 * Parse les CSV Typeform (PP et Client), extrait les codes projets,
 * récupère les prix depuis Plum Living, et met à jour les requests.
 * 
 * Usage:
 *   npx tsx scripts/fetch-prices-from-csv.ts
 *   npx tsx scripts/fetch-prices-from-csv.ts --pp-csv /path/to/pp.csv --client-csv /path/to/client.csv
 *   npx tsx scripts/fetch-prices-from-csv.ts --use-existing-prices
 * 
 * Options:
 *   --pp-csv <path>        Chemin vers le CSV Typeform PP (optionnel, cherche dans Downloads)
 *   --client-csv <path>    Chemin vers le CSV Typeform Client (optionnel, cherche dans Downloads)
 *   --use-existing-prices  Utiliser les prix existants du CSV comme fallback
 *   --no-assign-codes      Ne pas assigner les codes projets aux requests
 *   --dry-run              Mode test sans sauvegarder les modifications
 */

import fs from 'fs';
import path from 'path';
import { Request } from '../lib/types';
import { parseBothTypeformCSVs } from '../lib/typeform-csv-parser';
import { fetchPricesFromTypeformCSV } from '../lib/price-fetcher';
import { mapProjectsToRequests, updateRequestsWithProjectData, assignProjectCodesToRequests } from '../lib/project-mapping';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');
const downloadsPath = path.join(process.env.HOME || '/Users/sou', 'Downloads');

/**
 * Parse les arguments de ligne de commande
 */
function parseArgs(): {
  ppCsvPath?: string;
  clientCsvPath?: string;
  useExistingPrices: boolean;
  assignProjectCodes: boolean;
  dryRun: boolean;
  minDate?: string; // Date minimale au format YYYY-MM-DD
} {
  const args = process.argv.slice(2);
  const result = {
    ppCsvPath: undefined as string | undefined,
    clientCsvPath: undefined as string | undefined,
    useExistingPrices: false,
    assignProjectCodes: true,
    dryRun: false,
    minDate: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--pp-csv' && nextArg) {
      result.ppCsvPath = nextArg;
      i++;
    } else if (arg === '--client-csv' && nextArg) {
      result.clientCsvPath = nextArg;
      i++;
    } else if (arg === '--use-existing-prices') {
      result.useExistingPrices = true;
    } else if (arg === '--no-assign-codes') {
      result.assignProjectCodes = false;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--min-date' && nextArg) {
      result.minDate = nextArg;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx scripts/fetch-prices-from-csv.ts [options]

Options:
  --pp-csv <path>          Chemin vers le CSV Typeform PP
  --client-csv <path>       Chemin vers le CSV Typeform Client
  --use-existing-prices     Utiliser les prix existants du CSV comme fallback
  --no-assign-codes         Ne pas assigner les codes projets aux requests
  --dry-run                 Mode test sans sauvegarder les modifications
  --min-date <YYYY-MM-DD>   Filtrer les projets à partir de cette date (inclus)
  --help, -h                Afficher cette aide

Exemples:
  npx tsx scripts/fetch-prices-from-csv.ts
  npx tsx scripts/fetch-prices-from-csv.ts --pp-csv /path/to/pp.csv
  npx tsx scripts/fetch-prices-from-csv.ts --use-existing-prices --dry-run
  npx tsx scripts/fetch-prices-from-csv.ts --min-date 2024-11-15
      `);
      process.exit(0);
    }
  }

  return result;
}

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

function getRequests(): Request[] {
  try {
    if (!fs.existsSync(requestsPath)) {
      console.warn(`⚠️  Requests file not found: ${requestsPath}`);
      return [];
    }
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('❌ Error reading requests:', error);
    return [];
  }
}

function saveRequests(requests: Request[]): void {
  try {
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
    console.log(`✅ Saved ${requests.length} requests to ${requestsPath}`);
  } catch (error) {
    console.error('❌ Error saving requests:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Récupération des prix depuis CSV Typeform\n');

  const args = parseArgs();

  // Déterminer les chemins des CSV
  let ppCsvPath = args.ppCsvPath;
  let clientCsvPath = args.clientCsvPath;

  // Si non fournis, chercher dans Downloads
  if (!ppCsvPath || !clientCsvPath) {
    console.log(`📁 Searching for CSV files in ${downloadsPath}...`);
    const found = findTypeformCSVs();
    ppCsvPath = ppCsvPath || found.ppCsv;
    clientCsvPath = clientCsvPath || found.clientCsv;
  }

  if (!ppCsvPath && !clientCsvPath) {
    console.error('❌ No CSV files found.');
    console.error('   Please provide --pp-csv and/or --client-csv, or place CSV files in Downloads folder.');
    process.exit(1);
  }

  console.log(`📄 CSV Files:`);
  console.log(`   PP CSV: ${ppCsvPath || 'not provided'}`);
  console.log(`   Client CSV: ${clientCsvPath || 'not provided'}`);
  console.log(`   Use existing prices: ${args.useExistingPrices}`);
  console.log(`   Assign project codes: ${args.assignProjectCodes}`);
  console.log(`   Dry run: ${args.dryRun}`);
  
  // Déterminer la date minimale (par défaut: 15 novembre de l'année en cours)
  const today = new Date();
  const currentYear = today.getFullYear();
  const defaultMinDate = `${currentYear}-11-15`;
  const minDate = args.minDate || defaultMinDate;
  
  console.log(`   Min date filter: ${minDate}\n`);

  try {
    // Parser les CSV Typeform
    console.log('📊 Parsing Typeform CSVs...');
    const parseResult = parseBothTypeformCSVs(ppCsvPath, clientCsvPath);
    
    console.log(`✅ Parsed ${parseResult.stats.total} projects:`);
    console.log(`   - PP: ${parseResult.stats.pp}`);
    console.log(`   - Client: ${parseResult.stats.client}`);
    console.log(`   - With existing prices: ${parseResult.stats.withPrice}\n`);

    if (parseResult.projects.size === 0) {
      console.error('❌ No projects found in CSV files');
      process.exit(1);
    }

    // Filtrer les projets par date
    console.log(`📅 Filtering projects from ${minDate} onwards...`);
    const filteredProjects = new Map<string, import('../lib/typeform-csv-parser').ProjectData>();
    let filteredCount = 0;
    
    for (const [projectCode, projectData] of parseResult.projects.entries()) {
      if (!projectData.submitDate) {
        // Si pas de date, on garde le projet (pour ne pas perdre de données)
        filteredProjects.set(projectCode, projectData);
        continue;
      }
      
      // Comparer les dates (format YYYY-MM-DD)
      if (projectData.submitDate >= minDate) {
        filteredProjects.set(projectCode, projectData);
        filteredCount++;
      }
    }
    
    const removedCount = parseResult.projects.size - filteredProjects.size;
    console.log(`✅ Filtered to ${filteredProjects.size} projects (removed ${removedCount} projects before ${minDate})\n`);

    if (filteredProjects.size === 0) {
      console.error(`❌ No projects found after filtering (min date: ${minDate})`);
      process.exit(1);
    }
    
    // Remplacer parseResult.projects par les projets filtrés
    parseResult.projects = filteredProjects;

    // Récupérer les prix depuis Plum Living
    console.log('💰 Fetching prices from Plum Living...');
    console.log(`   Projects to process: ${parseResult.projects.size}`);
    console.log(`   Max concurrent requests: 5`);
    console.log(`   This may take a while...\n`);

    const prices = await fetchPricesFromTypeformCSV(
      parseResult.projects,
      5, // maxConcurrent
      args.useExistingPrices
    );

    const pricesFetched = Array.from(prices.values()).filter(p => p > 0).length;
    console.log(`\n✅ Fetched prices for ${pricesFetched} out of ${parseResult.projects.size} projects\n`);

    // Charger les requests existantes
    const requests = getRequests();
    console.log(`📋 Loaded ${requests.length} existing requests\n`);

    if (requests.length === 0) {
      console.warn('⚠️  No existing requests found. Prices will be fetched but not assigned.');
    } else {
      // Faire le mapping entre codes projets et requests
      console.log('🔗 Mapping projects to requests...');
      const mapping = mapProjectsToRequests(requests, parseResult.projects);
      
      console.log(`✅ Mapping results:`);
      console.log(`   - Matched: ${mapping.stats.matched}`);
      console.log(`   - Unmatched: ${mapping.stats.unmatched}\n`);

      // Mettre à jour les requests avec les prix et codes projets
      let updatedRequests = requests;

      if (args.assignProjectCodes) {
        console.log('📝 Assigning project codes to requests...');
        updatedRequests = assignProjectCodesToRequests(requests, mapping.matched);
      }

      console.log('💾 Updating requests with prices...');
      updatedRequests = updateRequestsWithProjectData(
        updatedRequests,
        parseResult.projects,
        prices,
        mapping.matched
      );

      // Compter les mises à jour
      const updatedCount = updatedRequests.filter((req, index) => {
        const original = requests[index];
        return original && (
          req.price !== original.price ||
          req.projectCode !== original.projectCode
        );
      }).length;

      console.log(`✅ Updated ${updatedCount} requests\n`);

      // Afficher quelques exemples de mises à jour
      if (updatedCount > 0 && !args.dryRun) {
        console.log('📊 Sample updates:');
        let shown = 0;
        for (let i = 0; i < updatedRequests.length && shown < 5; i++) {
          const updated = updatedRequests[i];
          const original = requests[i];
          if (original && (
            updated.price !== original.price ||
            updated.projectCode !== original.projectCode
          )) {
            console.log(`   ${updated.id}:`);
            if (updated.price !== original.price) {
              console.log(`     Price: ${original.price} → ${updated.price}`);
            }
            if (updated.projectCode !== original.projectCode) {
              console.log(`     Project Code: ${original.projectCode || 'none'} → ${updated.projectCode || 'none'}`);
            }
            shown++;
          }
        }
        console.log('');
      }

      // Sauvegarder les requests mises à jour
      if (!args.dryRun) {
        saveRequests(updatedRequests);
        console.log('🎉 Done!');
      } else {
        console.log('🔍 Dry run mode - no changes saved');
      }

      // Afficher les projets non matchés
      if (mapping.stats.unmatched > 0) {
        console.log(`\n⚠️  ${mapping.stats.unmatched} projects could not be matched to requests:`);
        const unmatchedProjects = Array.from(parseResult.projects.entries())
          .filter(([code]) => !mapping.matched.has(code))
          .slice(0, 10);
        
        unmatchedProjects.forEach(([code, data]) => {
          const price = prices.get(code) || data.price || 0;
          console.log(`   - ${code} (${data.type}): €${price}`);
        });
        
        if (mapping.stats.unmatched > 10) {
          console.log(`   ... and ${mapping.stats.unmatched - 10} more`);
        }
      }
    }

    // Résumé final
    console.log('\n📊 Summary:');
    console.log(`   Projects parsed: ${parseResult.stats.total}`);
    console.log(`   Prices fetched: ${pricesFetched}`);
    if (requests.length > 0) {
      console.log(`   Requests matched: ${mapping.stats.matched}`);
      console.log(`   Requests updated: ${updatedCount}`);
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
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

