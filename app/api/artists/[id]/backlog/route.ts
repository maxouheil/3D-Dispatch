import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request, Artist } from '@/lib/types';
import { dummyArtists } from '@/lib/dummy-data';
import { isBacklogStatus, isOngoingStatus, isSentStatus, isWithinCurrentWeek, getSentDate } from '@/lib/utils';

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

  // Get all artist requests (no date filter for backlog and ongoing)
  const artistRequests = requests.filter(
    req => req.assignedTo === params.id
  );
  
  // Get all backlog requests (new + pending) even if not assigned
  const backlogRequests = requests.filter(
    req => isBacklogStatus(req.status || '')
  );
  
  // Combine artist requests with backlog requests (avoid duplicates)
  const allRequests = [...artistRequests];
  backlogRequests.forEach(backlogReq => {
    if (!allRequests.find(r => r.id === backlogReq.id)) {
      allRequests.push(backlogReq);
    }
  });
  
  // Update artist stats with new rules:
  // - Backlog = new + pending (no date filter)
  // - Ongoing = transmitted to 3D artist (no date filter)
  // - Sent = sent to client (current week only)
  const backlogCount = artistRequests.filter(r => isBacklogStatus(r.status)).length;
  
  // Ongoing: transmitted to 3D artist (no date filter)
  const ongoingCount = artistRequests.filter(
    r => isOngoingStatus(r.status)
  ).length;
  
  // Sent: sent to client (current week only)
  // Use sentDate if available (date when sent to client), otherwise use date (date received)
  const sentCount = artistRequests.filter((r) => {
    const sentDate = getSentDate(r);
    return sentDate && isSentStatus(r.status) && isWithinCurrentWeek(sentDate);
  }).length;

  return NextResponse.json({
    artist: {
      ...artist,
      backlogCount,
      ongoingCount,
      sentCount,
    },
    requests: allRequests,
  });
}

