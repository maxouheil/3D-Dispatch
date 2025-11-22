/**
 * Script pour récupérer les thumbnails IKP depuis les CSV Typeform
 * Filtre les projets reçus après le 18 novembre
 * 
 * Usage: npx tsx scripts/fetch-thumbnails-from-csv.ts [--csv-dir=./csv] [--workers=3]
 */

import fs from 'fs';
import path from 'path';
import { parseTypeformCSV, ProjectData } from '../lib/typeform-csv-parser';
import { loginToPlumLiving } from '../lib/price-fetcher';
import puppeteer from 'puppeteer';
import { Request } from '../lib/types';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

function saveRequests(requests: Request[]): void {
  try {
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error('Error saving requests:', error);
  }
}

interface FetchResult {
  projectCode: string;
  thumbnail: string | null;
  success: boolean;
  error?: string;
  duration: number;
  clientName?: string;
}

async function fetchThumbnailWithBrowser(
  projectCode: string,
  browser: any,
  isLoggedIn: { value: boolean }
): Promise<string | null> {
  const page = await browser.newPage();
  
  try {
    const url = `https://plum-living.com/fr/project/${projectCode}`;
    
    // Intercepter les requêtes réseau AVANT la navigation
    const thumbnailUrls: string[] = [];
    const allImageUrls: string[] = [];
    
    page.on('response', (response: any) => {
      const responseUrl = response.url();
      if (responseUrl.includes('plumscannerfiles.blob.core.windows.net')) {
        allImageUrls.push(responseUrl);
        if (responseUrl.includes('thumbnail')) {
          thumbnailUrls.push(responseUrl);
        }
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Vérifier si on est redirigé vers la page de connexion
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      if (!isLoggedIn.value) {
        console.log('  🔐 Logging in...');
        const loginSuccess = await loginToPlumLiving(page);
        if (!loginSuccess) {
          return null;
        }
        isLoggedIn.value = true;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      } else {
        return null;
      }
    }

    // Attendre que les images se chargent
    await page.waitForTimeout(3000);

    // Vérifier les URLs interceptées (priorité aux thumbnails)
    if (thumbnailUrls.length > 0) {
      return thumbnailUrls[0];
    }

    // Si pas de thumbnail spécifique, chercher n'importe quelle image plumscannerfiles
    if (allImageUrls.length > 0) {
      // Chercher une image qui ressemble à un thumbnail (contient le projectCode ou date récente)
      const matchingUrl = allImageUrls.find(u => 
        u.includes(projectCode) || 
        u.includes('thumbnail') ||
        u.match(/\d{4}-\d{2}-\d{2}/) // Contient une date
      );
      if (matchingUrl) {
        return matchingUrl;
      }
      // Sinon, prendre la première image
      return allImageUrls[0];
    }

    // Chercher dans le DOM - toutes les images
    const thumbnailUrl = await page.evaluate((projectCode) => {
      // Chercher dans les balises img
      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.src || img.getAttribute('src') || '';
        if (src.includes('plumscannerfiles.blob.core.windows.net')) {
          if (src.includes('thumbnail') || src.includes(projectCode)) {
            return src;
          }
        }
      }

      // Chercher dans les styles background-image
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage.includes('plumscannerfiles.blob.core.windows.net')) {
          const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }

      // Chercher dans les attributs data-*
      for (const el of allElements) {
        for (const attr of el.attributes) {
          if (attr.value && attr.value.includes('plumscannerfiles.blob.core.windows.net')) {
            const urlMatch = attr.value.match(/https?:\/\/[^\s"']+plumscannerfiles[^\s"']*/);
            if (urlMatch && urlMatch[0]) {
              return urlMatch[0];
            }
          }
        }
      }

      return null;
    }, projectCode);

    // Si toujours pas trouvé, essayer de construire l'URL selon le pattern connu
    // Pattern: https://plumscannerfiles.blob.core.windows.net/qstransfer/{date}-{projectCode}-thumbnail.jpeg
    // On va essayer avec différentes dates récentes
    if (!thumbnailUrl) {
      const today = new Date();
      const datesToTry = [
        today.toISOString().replace(/:/g, '%3A').split('.')[0],
        new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().replace(/:/g, '%3A').split('.')[0],
        new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().replace(/:/g, '%3A').split('.')[0],
      ];
      
      // Vérifier si l'URL existe en faisant une requête HEAD
      for (const dateStr of datesToTry) {
        const constructedUrl = `https://plumscannerfiles.blob.core.windows.net/qstransfer/${dateStr}-${projectCode}-thumbnail.jpeg`;
        try {
          const response = await page.goto(constructedUrl, { waitUntil: 'networkidle0', timeout: 5000 });
          if (response && response.status() === 200) {
            return constructedUrl;
          }
        } catch (e) {
          // URL n'existe pas, continuer
        }
      }
    }

    return thumbnailUrl;
  } catch (error: any) {
    console.error(`  ⚠️  Error fetching thumbnail for ${projectCode}: ${error.message}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Trouve les fichiers CSV Typeform dans le dossier Downloads
 */
function findTypeformCSVs(): { ppCsv?: string; clientCsv?: string } {
  const downloadsPath = path.join(process.env.HOME || '/Users/sou', 'Downloads');
  
  if (!fs.existsSync(downloadsPath)) {
    return {};
  }

  const files = fs.readdirSync(downloadsPath);
  
  // Chercher spécifiquement les fichiers avec les IDs connus
  const ppCsv = files.find(f => f.includes('a25xCDxH') && f.endsWith('.csv'));
  const clientCsv = files.find(f => f.includes('oIygOgih') && f.endsWith('.csv'));

  return {
    ppCsv: ppCsv ? path.join(downloadsPath, ppCsv) : undefined,
    clientCsv: clientCsv ? path.join(downloadsPath, clientCsv) : undefined,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const ppCsvArg = args.find(arg => arg.startsWith('--pp-csv='));
  const clientCsvArg = args.find(arg => arg.startsWith('--client-csv='));
  const workersArg = args.find(arg => arg.startsWith('--workers='));
  const testArg = args.find(arg => arg.startsWith('--test='));
  const testMode = args.includes('--test') || testArg !== undefined;
  
  const workers = workersArg ? parseInt(workersArg.split('=')[1]) : 3;
  const testLimit = testArg ? parseInt(testArg.split('=')[1]) : (testMode ? 5 : undefined);

  console.log('🚀 Récupération des thumbnails IKP depuis les CSV Typeform');
  if (testLimit) {
    console.log(`   🧪 MODE TEST: ${testLimit} projets seulement`);
  }
  console.log(`   Workers: ${workers}`);
  console.log(`   Date limite: après le 18 novembre 2024`);
  console.log('');

  // Date limite: 18 novembre 2024
  const cutoffDate = new Date('2024-11-18');
  cutoffDate.setHours(0, 0, 0, 0);

  // Trouver les fichiers CSV
  let ppCsvPath = ppCsvArg ? ppCsvArg.split('=')[1] : undefined;
  let clientCsvPath = clientCsvArg ? clientCsvArg.split('=')[1] : undefined;

  // Si non fournis, chercher dans Downloads
  if (!ppCsvPath || !clientCsvPath) {
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
  console.log('');

  // Parser les CSV Typeform
  const allProjects = new Map<string, ProjectData>();
  
  if (ppCsvPath) {
    try {
      console.log(`📄 Parsing PP CSV: ${path.basename(ppCsvPath)}...`);
      const result = parseTypeformCSV(ppCsvPath, 'PP');
      
      // Filtrer les projets après le 18 novembre
      const filteredProjects = Array.from(result.projects.values()).filter(project => {
        if (!project.submitDate) {
          return false;
        }
        
        const submitDate = new Date(project.submitDate);
        return submitDate >= cutoffDate;
      });
      
      console.log(`   Total projects: ${result.projects.size}`);
      console.log(`   After Nov 18: ${filteredProjects.length}`);
      
      for (const project of filteredProjects) {
        allProjects.set(project.projectCode, project);
      }
    } catch (error: any) {
      console.error(`   ❌ Error parsing PP CSV: ${error.message}`);
    }
  }

  if (clientCsvPath) {
    try {
      console.log(`📄 Parsing Client CSV: ${path.basename(clientCsvPath)}...`);
      const result = parseTypeformCSV(clientCsvPath, 'Client');
      
      // Filtrer les projets après le 18 novembre
      const filteredProjects = Array.from(result.projects.values()).filter(project => {
        if (!project.submitDate) {
          return false;
        }
        
        const submitDate = new Date(project.submitDate);
        return submitDate >= cutoffDate;
      });
      
      console.log(`   Total projects: ${result.projects.size}`);
      console.log(`   After Nov 18: ${filteredProjects.length}`);
      
      for (const project of filteredProjects) {
        allProjects.set(project.projectCode, project);
      }
    } catch (error: any) {
      console.error(`   ❌ Error parsing Client CSV: ${error.message}`);
    }
  }

  console.log('');
  console.log(`📊 Total unique projects after Nov 18: ${allProjects.size}`);
  
  if (allProjects.size === 0) {
    console.log('✅ No projects found after November 18, 2024');
    return;
  }

  // Limiter à testLimit projets si en mode test
  let projectsArray = Array.from(allProjects.values());
  if (testLimit && testLimit > 0) {
    projectsArray = projectsArray.slice(0, testLimit);
    console.log(`🧪 Mode test: Limité à ${testLimit} projets`);
    console.log(`   ProjectCodes à tester: ${projectsArray.map(p => p.projectCode).join(', ')}`);
    console.log('');
  }

  // Charger les requests existantes pour mettre à jour
  const requests = getRequests();
  const requestsMap = new Map(requests.map(r => [r.projectCode || '', r]));

  // Créer les navigateurs
  const browsers = await Promise.all(
    Array(workers).fill(0).map(() =>
      puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    )
  );

  const isLoggedIn = { value: false };
  const allResults: FetchResult[] = [];
  const startTime = Date.now();

  try {
    // Traiter par batch
    const batchSize = 20;
    for (let i = 0; i < projectsArray.length; i += batchSize) {
      const batch = projectsArray.slice(i, i + batchSize);
      
      console.log(`\n📦 Batch ${Math.floor(i / batchSize) + 1}: Projects ${i + 1}-${Math.min(i + batchSize, projectsArray.length)}`);
      
      // Diviser le batch entre les workers
      const chunkSize = Math.ceil(batch.length / workers);
      
      const batchResults = await Promise.all(
        Array(workers).fill(0).map((_, workerIndex) => {
          const chunkStart = workerIndex * chunkSize;
          const chunkEnd = Math.min(chunkStart + chunkSize, batch.length);
          const chunk = batch.slice(chunkStart, chunkEnd);
          
          if (chunk.length === 0) {
            return Promise.resolve([]);
          }
          
          return Promise.all(
            chunk.map(async (project) => {
              const startTime = Date.now();
              try {
                const thumbnail = await fetchThumbnailWithBrowser(
                  project.projectCode,
                  browsers[workerIndex],
                  isLoggedIn
                );
                
                const duration = (Date.now() - startTime) / 1000;
                
                const result: FetchResult = {
                  projectCode: project.projectCode,
                  thumbnail,
                  success: !!thumbnail,
                  duration,
                  clientName: project.clientName,
                };
                
                if (thumbnail) {
                  console.log(`  ✅ ${project.projectCode}: ${thumbnail.substring(0, 80)}... (${duration.toFixed(1)}s)`);
                } else {
                  console.log(`  ❌ ${project.projectCode}: Thumbnail not found (${duration.toFixed(1)}s)`);
                }
                
                return result;
              } catch (error: any) {
                const duration = (Date.now() - startTime) / 1000;
                const result: FetchResult = {
                  projectCode: project.projectCode,
                  thumbnail: null,
                  success: false,
                  error: error.message,
                  duration,
                  clientName: project.clientName,
                };
                console.log(`  ❌ ${project.projectCode}: Error - ${error.message} (${duration.toFixed(1)}s)`);
                return result;
              }
            })
          );
        })
      );
      
      const flatResults = batchResults.flat().flat();
      allResults.push(...flatResults);
      
      // Mettre à jour les requests avec les thumbnails trouvés
      let updated = 0;
      for (const result of flatResults) {
        if (result.success && result.thumbnail) {
          // Trouver la request correspondante par projectCode
          const request = requestsMap.get(result.projectCode);
          if (request) {
            request.thumbnail = result.thumbnail;
            updated++;
          } else {
            // Si pas de request existante, on pourrait en créer une, mais pour l'instant on skip
            console.log(`  ⚠️  No request found for projectCode: ${result.projectCode}`);
          }
        }
      }
      
      // Sauvegarder progressivement
      if (updated > 0) {
        saveRequests(requests);
        console.log(`   💾 ${updated} thumbnails sauvegardés`);
      }
    }
  } finally {
    // Fermer tous les navigateurs
    await Promise.all(browsers.map(b => b.close()));
  }

  const totalTime = (Date.now() - startTime) / 1000;
  const successful = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;
  const avgTime = allResults.length > 0 
    ? allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length 
    : 0;

  console.log('\n📊 Résumé:');
  console.log(`   Total projets traités: ${allResults.length}`);
  console.log(`   ✅ Réussis: ${successful}`);
  console.log(`   ❌ Échoués: ${failed}`);
  console.log(`   ⏱️  Temps total: ${(totalTime / 60).toFixed(1)} minutes`);
  if (avgTime > 0) {
    console.log(`   ⚡ Temps moyen par projet: ${avgTime.toFixed(1)}s`);
    console.log(`   📈 Débit: ${(allResults.length / totalTime * 60).toFixed(1)} projets/minute`);
  }
}

main().catch(console.error);

