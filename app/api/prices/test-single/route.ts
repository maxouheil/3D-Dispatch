import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request } from '@/lib/types';
import { fetchPriceFromPlumLiving } from '@/lib/price-fetcher';

// Augmenter le timeout à 5 minutes pour un seul projet
export const maxDuration = 300; // 5 minutes
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
 * Route API pour tester la récupération d'un prix sur UN seul projet
 * POST /api/prices/test-single
 * Body: { "projectCode": "..." } ou { "requestNumber": 2497 }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { projectCode, requestNumber } = body;

    console.log(`🧪 Testing price fetching on single project...`);

    const requests = getRequests();
    console.log(`Loaded ${requests.length} requests`);

    // Trouver la request
    let targetRequest: Request | undefined;
    if (projectCode) {
      targetRequest = requests.find(r => r.projectCode === projectCode);
    } else if (requestNumber) {
      targetRequest = requests.find(r => r.number === requestNumber);
    } else {
      return NextResponse.json({
        success: false,
        message: 'Please provide projectCode or requestNumber',
      }, { status: 400 });
    }

    if (!targetRequest) {
      return NextResponse.json({
        success: false,
        message: `Request not found (projectCode: ${projectCode || 'N/A'}, number: ${requestNumber || 'N/A'})`,
      }, { status: 404 });
    }

    if (!targetRequest.projectCode) {
      return NextResponse.json({
        success: false,
        message: `Request #${targetRequest.number} has no projectCode`,
      }, { status: 400 });
    }

    console.log(`🎯 Fetching price for request #${targetRequest.number} (${targetRequest.clientName})...`);
    console.log(`  ProjectCode: ${targetRequest.projectCode}`);
    console.log(`  URL: https://plum-living.com/fr/project/${targetRequest.projectCode}`);
    console.log(`  Current price: ${targetRequest.price || 0} €`);

    const startTime = Date.now();
    let price = 0;
    let error: string | undefined;

    try {
      price = await fetchPriceFromPlumLiving(targetRequest.projectCode);
    } catch (err: any) {
      error = err.message;
      console.error(`  ❌ Error: ${error}`);
    }

    const duration = Date.now() - startTime;

    if (price > 0) {
      // Mettre à jour le prix
      targetRequest.price = price;
      const index = requests.findIndex(r => r.id === targetRequest!.id);
      if (index !== -1) {
        requests[index] = targetRequest;
        saveRequests(requests);
        console.log(`  ✅ Price fetched: ${price} € - Duration: ${duration}ms`);
      }
    } else {
      console.log(`  ❌ No price found (returned 0) - Duration: ${duration}ms`);
      if (!error) {
        error = 'No price found (returned 0)';
      }
    }

    return NextResponse.json({
      success: price > 0,
      message: price > 0 
        ? `Prix récupéré avec succès: ${price} €` 
        : `Aucun prix trouvé${error ? `: ${error}` : ''}`,
      result: {
        requestId: targetRequest.id,
        number: targetRequest.number,
        clientName: targetRequest.clientName,
        projectCode: targetRequest.projectCode,
        price,
        duration,
        error,
      },
    });
  } catch (error: any) {
    console.error('❌ Error testing price fetching:', error);
    return NextResponse.json(
      {
        error: 'Failed to test price fetching',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

