import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request } from '@/lib/types';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const requests = getRequests();
  
  // Return all requests from all artists (no filter)
  // This includes all statuses and all artists
  return NextResponse.json({
    requests: requests,
  });
}

