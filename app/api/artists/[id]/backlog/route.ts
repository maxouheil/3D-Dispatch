import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request, Artist } from '@/lib/types';
import { dummyArtists } from '@/lib/dummy-data';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');
const artistsPath = path.join(process.cwd(), 'data', 'artists.json');

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

function getArtists(): Artist[] {
  try {
    const fileContents = fs.readFileSync(artistsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return dummyArtists;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requests = getRequests();
  const artists = getArtists();
  
  const artist = artists.find(a => a.id === params.id);
  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  const artistRequests = requests.filter(req => req.assignedTo === params.id);
  
  // Update artist stats
  const backlogCount = artistRequests.filter(r => r.status === 'new').length;
  const ongoingCount = artistRequests.filter(r => r.status === 'ongoing').length;
  const sentCount = artistRequests.filter(r => r.status === 'sent').length;

  return NextResponse.json({
    artist: {
      ...artist,
      backlogCount,
      ongoingCount,
      sentCount,
    },
    requests: artistRequests,
  });
}

