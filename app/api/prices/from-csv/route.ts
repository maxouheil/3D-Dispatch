import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request } from '@/lib/types';
import { parseBothTypeformCSVs } from '@/lib/typeform-csv-parser';
import { fetchPricesFromTypeformCSV } from '@/lib/price-fetcher';
import { mapProjectsToRequests, updateRequestsWithProjectData, assignProjectCodesToRequests } from '@/lib/project-mapping';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');
const downloadsPath = path.join(process.env.HOME || '/Users/sou', 'Downloads');

/**
 * Trouve les fichiers CSV Typeform dans le dossier Downloads
 */
function findTypeformCSVs(): { ppCsv?: string; clientCsv?: string } {
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
      return [];
    }
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading requests:', error);
    return [];
  }
}

function saveRequests(requests: Request[]): void {
  try {
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error('Error saving requests:', error);
    throw error;
  }
}

// Note: Le timeout de Next.js pour les routes API peut être limité
// Si cette route timeout, il faudra peut-être diviser le processus en plusieurs requêtes plus petites

/**
 * Route API pour synchroniser les prix depuis les CSV Typeform
 * 
 * POST /api/prices/from-csv
 * Body (optionnel):
 * {
 *   "ppCsvPath": "/path/to/pp.csv",
 *   "clientCsvPath": "/path/to/client.csv",
 *   "useExistingPrices": false, // Utiliser les prix du CSV comme fallback
 *   "assignProjectCodes": true  // Assigner les codes projets aux requests
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 Starting price fetch from CSV at', new Date().toISOString());
  
  try {
    const body = await request.json().catch(() => ({}));
    
    // Déterminer les chemins des CSV
    let ppCsvPath = body.ppCsvPath;
    let clientCsvPath = body.clientCsvPath;
    
    // Si non fournis, chercher dans Downloads
    if (!ppCsvPath || !clientCsvPath) {
      const found = findTypeformCSVs();
      ppCsvPath = ppCsvPath || found.ppCsv;
      clientCsvPath = clientCsvPath || found.clientCsv;
    }

    if (!ppCsvPath && !clientCsvPath) {
      return NextResponse.json(
        { 
          error: 'No CSV files found. Please provide ppCsvPath and/or clientCsvPath, or place CSV files in Downloads folder.',
          searchedPath: downloadsPath
        },
        { status: 400 }
      );
    }

    const useExistingPrices = body.useExistingPrices === true;
    const assignProjectCodes = body.assignProjectCodes !== false; // Par défaut: true

    console.log('Parsing Typeform CSVs...');
    console.log(`PP CSV: ${ppCsvPath || 'not provided'}`);
    console.log(`Client CSV: ${clientCsvPath || 'not provided'}`);

    // Parser les CSV Typeform
    const parseResult = parseBothTypeformCSVs(ppCsvPath, clientCsvPath);
    
    console.log(`Parsed ${parseResult.stats.total} projects:`);
    console.log(`  - PP: ${parseResult.stats.pp}`);
    console.log(`  - Client: ${parseResult.stats.client}`);
    console.log(`  - With existing prices: ${parseResult.stats.withPrice}`);

    if (parseResult.projects.size === 0) {
      return NextResponse.json(
        { error: 'No projects found in CSV files' },
        { status: 400 }
      );
    }

    // Charger les requests existantes AVANT de récupérer les prix
    const requests = getRequests();
    console.log(`Loaded ${requests.length} existing requests`);

    // Filtrer pour ne récupérer que les prix des projets qui sont déjà mappés aux requests
    // et qui n'ont pas encore de prix, OU qui sont dans le CSV
    const projectsToFetch = new Map<string, { type: 'PP' | 'Client'; price?: number; email?: string }>();
    
    // 1. Ajouter tous les projets du CSV
    parseResult.projects.forEach((data, projectCode) => {
      projectsToFetch.set(projectCode, data);
    });
    
    // 2. Ajouter aussi les requests qui ont un projectCode mais pas de prix
    const requestsWithoutPrice = requests.filter(r => r.projectCode && (!r.price || r.price === 0));
    console.log(`Found ${requestsWithoutPrice.length} requests with projectCode but no price`);
    
    requestsWithoutPrice.forEach(req => {
      if (req.projectCode && !projectsToFetch.has(req.projectCode)) {
        projectsToFetch.set(req.projectCode, { type: req.type });
      }
    });

    // Limiter à un petit nombre pour éviter les timeouts
    const maxProjects = body.maxProjects || 5;
    const allProjects = Array.from(projectsToFetch.entries());
    const limitedProjects = allProjects.slice(0, maxProjects);
    const limitedProjectsMap = new Map(limitedProjects);
    
    console.log(`💰 Fetching prices for ${limitedProjects.length} projects (limited from ${projectsToFetch.size} total)`);
    if (projectsToFetch.size > maxProjects) {
      console.log(`⚠️ Limiting to first ${maxProjects} projects to avoid timeout. ${projectsToFetch.size - maxProjects} remaining.`);
    }
    
    const pricesStartTime = Date.now();
    const prices = await fetchPricesFromTypeformCSV(
      limitedProjectsMap,
      2, // maxConcurrent (réduit à 2 pour éviter les timeouts)
      useExistingPrices
    );

    const pricesElapsed = Math.round((Date.now() - pricesStartTime) / 1000);
    const pricesFetched = Array.from(prices.values()).filter(p => p > 0).length;
    console.log(`✅ Fetched prices for ${pricesFetched} out of ${limitedProjects.length} projects in ${pricesElapsed}s`);

    // Faire le mapping entre codes projets et requests
    const mapping = mapProjectsToRequests(requests, parseResult.projects);
    console.log(`Mapping results:`);
    console.log(`  - Matched: ${mapping.stats.matched}`);
    console.log(`  - Unmatched: ${mapping.stats.unmatched}`);

    // Mettre à jour les requests avec les prix et codes projets
    let updatedRequests = requests;

    if (assignProjectCodes) {
      // Assigner les codes projets aux requests correspondantes
      updatedRequests = assignProjectCodesToRequests(requests, mapping.matched);
    }

    // Mettre à jour les prix
    updatedRequests = updateRequestsWithProjectData(
      updatedRequests,
      parseResult.projects,
      prices,
      mapping.matched // Passer le mapping pour que les nouveaux matchings soient pris en compte
    );

    // Compter les mises à jour
    const updatedCount = updatedRequests.filter((req, index) => {
      const original = requests[index];
      return original && (
        req.price !== original.price ||
        req.projectCode !== original.projectCode
      );
    }).length;

    // Sauvegarder les requests mises à jour
    saveRequests(updatedRequests);
    console.log(`Updated ${updatedCount} requests`);

    // Préparer les statistiques de réponse
    const unmatchedProjects = Array.from(parseResult.projects.entries())
      .filter(([code]) => !mapping.matched.has(code))
      .map(([code, data]) => ({
        projectCode: code,
        type: data.type,
        price: prices.get(code) || data.price || 0,
      }));

    const remainingCount = Math.max(0, projectsToFetch.size - maxProjects);
    
    return NextResponse.json({
      success: true,
      stats: {
        projectsParsed: parseResult.stats.total,
        ppProjects: parseResult.stats.pp,
        clientProjects: parseResult.stats.client,
        pricesFetched,
        requestsMatched: mapping.stats.matched,
        requestsUnmatched: mapping.stats.unmatched,
        requestsUpdated: updatedCount,
        projectsProcessed: limitedProjects.length,
        projectsRemaining: remainingCount,
      },
      unmatchedProjects: unmatchedProjects.slice(0, 20), // Limiter à 20 pour la réponse
      unmatchedCount: unmatchedProjects.length,
      message: remainingCount > 0 
        ? `Récupéré ${pricesFetched} prix sur ${limitedProjects.length} projets traités. ${remainingCount} projets restants. Relancez pour continuer.`
        : `Récupéré ${pricesFetched} prix sur ${limitedProjects.length} projets.`,
    });
  } catch (error: any) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.error(`❌ Error fetching prices from CSV after ${elapsed}s:`, error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to fetch prices from CSV',
        message: error.message,
        elapsedSeconds: elapsed,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    const totalElapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️ Total execution time: ${totalElapsed}s (${Math.round(totalElapsed / 60)} minutes)`);
  }
}

