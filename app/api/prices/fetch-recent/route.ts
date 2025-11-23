import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request } from '@/lib/types';
import { fetchPriceFromPlumLiving } from '@/lib/price-fetcher';

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
 * Route API pour récupérer les prix depuis Plum Living pour les requests récentes
 * POST /api/prices/fetch-recent
 * Body (optionnel):
 * {
 *   "days": 7,  // Nombre de jours (défaut: 7)
 *   "maxRequests": 5  // Nombre max de requests à traiter (défaut: 5)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const days = body.days || 7;
    const maxRequests = body.maxRequests || 5;

    console.log(`🚀 Fetching prices from Plum Living for requests from last ${days} days (max ${maxRequests})...`);

    const requests = getRequests();
    console.log(`Loaded ${requests.length} requests`);

    // Filtrer les requests récentes avec projectCode mais sans prix (ou prix suspect < 100€)
    const now = new Date();
    const daysAgo = new Date(now);
    daysAgo.setDate(now.getDate() - days);

    const requestsToFetch = requests
      .filter(req => {
        if (!req.date || !req.projectCode) return false;
        const reqDate = new Date(req.date);
        return reqDate >= daysAgo && (!req.price || req.price === 0 || req.price < 100);
      })
      .slice(0, maxRequests);

    console.log(`Found ${requestsToFetch.length} requests to fetch prices for`);

    if (requestsToFetch.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No requests found without prices',
        stats: {
          requestsProcessed: 0,
          pricesFetched: 0,
        },
      });
    }

    // Créer un index par ID
    const requestsById = new Map<string, Request>();
    requests.forEach(req => {
      requestsById.set(req.id, req);
    });

    const results: Array<{ requestId: string; number: number; price: number; success: boolean }> = [];
    let fetchedCount = 0;

    // Récupérer les prix un par un
    for (let i = 0; i < requestsToFetch.length; i++) {
      const req = requestsToFetch[i];
      console.log(`[${i + 1}/${requestsToFetch.length}] Fetching price for request #${req.number}...`);
      console.log(`  ProjectCode: ${req.projectCode}`);
      console.log(`  URL: https://plum-living.com/fr/project/${req.projectCode}`);

      try {
        const price = await fetchPriceFromPlumLiving(req.projectCode!);
        
        if (price > 0) {
          const updatedRequest = requestsById.get(req.id);
          if (updatedRequest) {
            updatedRequest.price = price;
            fetchedCount++;
            results.push({
              requestId: req.id,
              number: req.number,
              price,
              success: true,
            });
            console.log(`  ✅ Price fetched: ${price} €`);
          }
        } else {
          console.log(`  ❌ No price found (returned 0)`);
          results.push({
            requestId: req.id,
            number: req.number,
            price: 0,
            success: false,
          });
        }
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        results.push({
          requestId: req.id,
          number: req.number,
          price: 0,
          success: false,
        });
      }

      // Délai entre les requêtes
      if (i < requestsToFetch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Sauvegarder
    const updatedRequests = Array.from(requestsById.values());
    saveRequests(updatedRequests);

    console.log(`✅ Fetched ${fetchedCount} prices out of ${requestsToFetch.length} requests`);

    return NextResponse.json({
      success: true,
      message: `Récupéré ${fetchedCount} prix sur ${requestsToFetch.length} requests`,
      stats: {
        requestsProcessed: requestsToFetch.length,
        pricesFetched: fetchedCount,
      },
      results,
    });
  } catch (error: any) {
    console.error('❌ Error fetching prices:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch prices',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

