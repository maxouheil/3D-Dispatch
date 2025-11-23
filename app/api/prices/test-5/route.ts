import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request } from '@/lib/types';
import { fetchPriceFromPlumLiving } from '@/lib/price-fetcher';
import { testLogsStore } from '@/lib/test-logs-store';

// Augmenter le timeout à 10 minutes pour permettre le scraping de plusieurs projets
export const maxDuration = 600; // 10 minutes (600 secondes)
export const dynamic = 'force-dynamic';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');

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

/**
 * Route API pour tester la récupération des prix sur les 5 derniers projets
 * (Deschamps à Cherfan)
 * POST /api/prices/test-5
 */
export async function POST(request: NextRequest) {
  const testId = `test-${Date.now()}`;
  testLogsStore.startTest(testId);
  
  // Helper pour logger à la fois dans console et dans le store
  const log = (message: string, type: 'log' | 'progress' | 'result' | 'complete' = 'log', data?: any) => {
    console.log(message);
    testLogsStore.addLog(message, type, data);
  };

  try {
    log(`🧪 Testing price fetching on 5 recent projects...`);

    const requests = getRequests();
    log(`📊 Loaded ${requests.length} requests`);

    // Les 5 derniers projets: Deschamps, Carole Bellot, Cherfan (2x), Barthes
    // Selon l'ordre décroissant: 2497, 2496, 2495, 2494, 1242
    const targetProjectCodes = [
      'fc38cab7-2ee0-42d6-8d4e-ec2332287e95', // 2497 - DESCHAMPS
      'f838c96e-ffdd-4b7d-b65c-6129bc7a8f70', // 2496 - CAROLE BELLOT
      '71bfe93d-398e-4ceb-84a7-26a52aa020b4', // 2495 - CHERFAN
      'b0198302-8b69-499a-b770-708dfca2dad6', // 2494 - CHERFAN
      '82dd37e4-d52b-4451-b211-4e85c422be6e', // 1242 - BARTHES
    ];

    // Trouver les requests correspondantes
    const requestsToFetch: Request[] = [];
    for (const projectCode of targetProjectCodes) {
      const req = requests.find(r => r.projectCode === projectCode);
      if (req) {
        requestsToFetch.push(req);
      } else {
        log(`⚠️  Request not found for projectCode: ${projectCode}`, 'log');
      }
    }

    log(`📋 Found ${requestsToFetch.length} requests to test:`, 'log');
    requestsToFetch.forEach(req => {
      log(`  - #${req.number} - ${req.clientName} - ${req.projectCode}`, 'log');
    });

    if (requestsToFetch.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No requests found for the specified project codes',
      });
    }

    // Créer un index par ID
    const requestsById = new Map<string, Request>();
    requests.forEach(req => {
      requestsById.set(req.id, req);
    });

    const results: Array<{ 
      requestId: string; 
      number: number; 
      clientName: string;
      projectCode: string; 
      price: number; 
      success: boolean;
      error?: string;
    }> = [];
    let fetchedCount = 0;

    // Récupérer les prix un par un
    for (let i = 0; i < requestsToFetch.length; i++) {
      const req = requestsToFetch[i];
      log(`\n[${i + 1}/${requestsToFetch.length}] 🎯 Fetching price for request #${req.number} (${req.clientName})...`, 'log');
      log(`  ProjectCode: ${req.projectCode}`, 'log');
      log(`  URL: https://plum-living.com/fr/project/${req.projectCode}`, 'log');
      log(`  Current price: ${req.price || 0} €`, 'log');
      
      log('', 'progress', { 
        current: i + 1, 
        total: requestsToFetch.length,
        request: {
          number: req.number,
          clientName: req.clientName,
        }
      });

      try {
        const startTime = Date.now();
        const price = await fetchPriceFromPlumLiving(req.projectCode!);
        const duration = Date.now() - startTime;
        
        if (price > 0) {
          const updatedRequest = requestsById.get(req.id);
          if (updatedRequest) {
            const oldPrice = updatedRequest.price || 0;
            updatedRequest.price = price;
            fetchedCount++;
            results.push({
              requestId: req.id,
              number: req.number,
              clientName: req.clientName,
              projectCode: req.projectCode!,
              price,
              success: true,
            });
            log(`  ✅ Price fetched: ${price} € (was ${oldPrice} €) - Duration: ${duration}ms`, 'log');
            log('', 'result', { 
              requestNumber: req.number,
              clientName: req.clientName,
              price,
              success: true 
            });
          }
        } else {
          log(`  ❌ No price found (returned 0) - Duration: ${duration}ms`, 'log');
          results.push({
            requestId: req.id,
            number: req.number,
            clientName: req.clientName,
            projectCode: req.projectCode!,
            price: 0,
            success: false,
            error: 'No price found (returned 0)',
          });
          log('', 'result', { 
            requestNumber: req.number,
            clientName: req.clientName,
            price: 0,
            success: false,
            error: 'No price found'
          });
        }
      } catch (error: any) {
        log(`  ❌ Error: ${error.message}`, 'log');
        results.push({
          requestId: req.id,
          number: req.number,
          clientName: req.clientName,
          projectCode: req.projectCode!,
          price: 0,
          success: false,
          error: error.message,
        });
        log('', 'result', { 
          requestNumber: req.number,
          clientName: req.clientName,
          price: 0,
          success: false,
          error: error.message
        });
      }

      // Délai entre les requêtes (3 secondes pour éviter de surcharger)
      if (i < requestsToFetch.length - 1) {
        log(`  ⏳ Waiting 3 seconds before next request...`, 'log');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Sauvegarder
    const updatedRequests = Array.from(requestsById.values());
    saveRequests(updatedRequests);

    log(`\n✅ Test completed: Fetched ${fetchedCount} prices out of ${requestsToFetch.length} requests`, 'log');
    log('', 'complete', {
      success: true,
      stats: {
        requestsProcessed: requestsToFetch.length,
        pricesFetched: fetchedCount,
      },
      results,
    });

    testLogsStore.endTest();

    return NextResponse.json({
      success: true,
      message: `Test terminé: ${fetchedCount} prix récupérés sur ${requestsToFetch.length} projets`,
      stats: {
        requestsProcessed: requestsToFetch.length,
        pricesFetched: fetchedCount,
      },
      results,
      testId,
    });
  } catch (error: any) {
    log(`❌ Error testing price fetching: ${error.message}`, 'log');
    log('', 'complete', {
      success: false,
      error: error.message,
    });
    testLogsStore.endTest();
    
    return NextResponse.json(
      {
        error: 'Failed to test price fetching',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        testId,
      },
      { status: 500 }
    );
  }
}

