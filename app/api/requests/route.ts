import { NextRequest, NextResponse } from 'next/server';
import { dummyRequests } from '@/lib/dummy-data';
import { Request } from '@/lib/types';
import fs from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data', 'requests.json');

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return dummyRequests;
  }
}

function saveRequests(requests: Request[]): void {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error('Error saving requests:', error);
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const artistId = searchParams.get('artistId');
  const status = searchParams.get('status');

  let requests = getRequests();

  if (artistId) {
    requests = requests.filter(req => req.assignedTo === artistId);
  }

  if (status) {
    requests = requests.filter(req => req.status === status);
  }

  return NextResponse.json(requests);
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    let requests = getRequests();
    const index = requests.findIndex(req => req.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    requests[index] = { ...requests[index], ...updates };
    saveRequests(requests);

    return NextResponse.json(requests[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requests = getRequests();
    
    // Generate new ID
    const maxNumber = Math.max(...requests.map(r => r.number), 2300);
    const newRequest: Request = {
      id: `req-${maxNumber + 1}`,
      number: maxNumber + 1,
      clientName: body.clientName || 'Unknown',
      type: body.type || 'Client',
      date: new Date().toISOString(),
      status: body.status || '',
      assignedTo: body.assignedTo || null,
      price: body.price || 0,
      ikpLink: body.ikpLink || `https://ikp.ikea.com/request/${maxNumber + 1}`,
      design: body.design || '',
      colors: body.colors || {},
      description: body.description || '',
      thumbnail: body.thumbnail || '/thumbnails/ikea-1.jpg',
      renders: [],
    };

    requests.push(newRequest);
    saveRequests(requests);

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

