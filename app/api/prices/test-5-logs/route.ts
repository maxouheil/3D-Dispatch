import { NextRequest, NextResponse } from 'next/server';
import { testLogsStore } from '@/lib/test-logs-store';

/**
 * Route API pour récupérer les logs du test en cours
 * GET /api/prices/test-5-logs?testId=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testId = searchParams.get('testId') || testLogsStore.getCurrentTestId();

    if (!testId) {
      return NextResponse.json({
        logs: [],
        testId: null,
      });
    }

    const logs = testLogsStore.getLogs(testId);

    return NextResponse.json({
      logs,
      testId,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to get logs',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

