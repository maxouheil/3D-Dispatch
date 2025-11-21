import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request } from '@/lib/types';
import { fetchPriceFromDriveLink } from '@/lib/price-fetcher';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');

/**
 * Route API pour récupérer et mettre à jour le prix d'une request spécifique
 * 
 * POST /api/requests/[id]/price - Récupère le prix depuis Google Drive et Plum Living
 * 
 * Usage:
 *   fetch('/api/requests/pp-req-2497/price', { method: 'POST' })
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id;

    // Lire les requests existants
    if (!fs.existsSync(requestsPath)) {
      return NextResponse.json(
        { error: 'Requests file not found' },
        { status: 404 }
      );
    }

    const requestsData = fs.readFileSync(requestsPath, 'utf8');
    const requests: Request[] = JSON.parse(requestsData);

    // Trouver la request
    const targetRequest = requests.find((r) => r.id === requestId);
    if (!targetRequest) {
      return NextResponse.json(
        { error: `Request ${requestId} not found` },
        { status: 404 }
      );
    }

    // Vérifier qu'il y a un lien Drive
    if (!targetRequest.ikpLink || !targetRequest.ikpLink.trim()) {
      return NextResponse.json(
        { error: 'No drive link found for this request' },
        { status: 400 }
      );
    }

    // Préparer la configuration Google
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'GOOGLE_SHEETS_ID not configured' },
        { status: 500 }
      );
    }

    const config: any = {
      spreadsheetId,
    };

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      config.serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
      config.serviceAccountKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
    } else {
      return NextResponse.json(
        {
          error:
            'GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_JSON must be configured',
        },
        { status: 500 }
      );
    }

    // Récupérer le prix
    const price = await fetchPriceFromDriveLink(
      targetRequest.ikpLink,
      targetRequest.type,
      config
    );

    // Mettre à jour le prix dans la request
    targetRequest.price = price;

    // Sauvegarder les requests mis à jour
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));

    return NextResponse.json({
      success: true,
      requestId,
      price,
      message: price > 0 ? 'Price fetched successfully' : 'Price not found or error occurred',
    });
  } catch (error: any) {
    console.error(`Error fetching price for request ${params.id}:`, error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch price',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/requests/[id]/price - Récupère le prix actuel d'une request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id;

    // Lire les requests existants
    if (!fs.existsSync(requestsPath)) {
      return NextResponse.json(
        { error: 'Requests file not found' },
        { status: 404 }
      );
    }

    const requestsData = fs.readFileSync(requestsPath, 'utf8');
    const requests: Request[] = JSON.parse(requestsData);

    // Trouver la request
    const targetRequest = requests.find((r) => r.id === requestId);
    if (!targetRequest) {
      return NextResponse.json(
        { error: `Request ${requestId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      requestId,
      price: targetRequest.price,
      ikpLink: targetRequest.ikpLink,
      type: targetRequest.type,
    });
  } catch (error: any) {
    console.error(`Error getting price for request ${params.id}:`, error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to get price',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

