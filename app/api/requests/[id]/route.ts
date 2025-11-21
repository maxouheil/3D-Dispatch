import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request } from '@/lib/types';

const dataPath = path.join(process.cwd(), 'data', 'requests.json');

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

function saveRequests(requests: Request[]): void {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error('Error saving requests:', error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requests = getRequests();
  const req = requests.find(r => r.id === params.id);

  if (!req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  return NextResponse.json(req);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    let requests = getRequests();
    const index = requests.findIndex(req => req.id === params.id);

    if (index === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    requests[index] = { ...requests[index], ...body };
    saveRequests(requests);

    return NextResponse.json(requests[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

