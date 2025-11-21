import { NextRequest, NextResponse } from 'next/server';

/**
 * Route pour lister tous les onglets du spreadsheet
 * GET /api/sheets/list
 */
export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'GOOGLE_SHEETS_ID not configured' }, { status: 500 });
    }

    const googleSheets = await import('@/lib/google-sheets-impl');
    
    const config: any = {
      spreadsheetId,
    };

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      config.serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
      config.serviceAccountKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
    } else {
      return NextResponse.json({ error: 'Credentials not configured' }, { status: 500 });
    }

    // Lister toutes les feuilles
    const sheets = await googleSheets.listSheets(config);
    
    return NextResponse.json({
      sheets: sheets.map(s => ({
        title: s.title,
        sheetId: s.sheetId,
      })),
      total: sheets.length,
    });
  } catch (error: any) {
    console.error('Error listing sheets:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to list sheets',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

