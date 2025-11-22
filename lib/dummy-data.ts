import { Request, Artist, RequestStatus, RequestType } from './types';

// Generate dummy artists
export const dummyArtists: Artist[] = [
  {
    id: '1',
    name: 'Vitalii',
    targetPerWeek: 30,
    currentWeekCompleted: 6,
    backlogCount: 3,
    ongoingCount: 2,
    sentCount: 12,
    performanceScore: 85,
  },
  {
    id: '2',
    name: 'Vladyslav',
    targetPerWeek: 20,
    currentWeekCompleted: 5,
    backlogCount: 4,
    ongoingCount: 3,
    sentCount: 10,
    performanceScore: 78,
  },
  {
    id: '3',
    name: 'Xuan',
    targetPerWeek: 20,
    currentWeekCompleted: 7,
    backlogCount: 2,
    ongoingCount: 2,
    sentCount: 15,
    performanceScore: 92,
  },
  {
    id: '4',
    name: 'Mychailo',
    targetPerWeek: 15,
    currentWeekCompleted: 4,
    backlogCount: 5,
    ongoingCount: 1,
    sentCount: 8,
    performanceScore: 72,
  },
  {
    id: '5',
    name: 'Konstantin',
    targetPerWeek: 10,
    currentWeekCompleted: 6,
    backlogCount: 3,
    ongoingCount: 3,
    sentCount: 11,
    performanceScore: 80,
  },
  {
    id: '6',
    name: 'Sarabjot',
    targetPerWeek: 10,
    currentWeekCompleted: 5,
    backlogCount: 4,
    ongoingCount: 2,
    sentCount: 9,
    performanceScore: 75,
  },
  {
    id: '7',
    name: 'Mustafa',
    targetPerWeek: 10,
    currentWeekCompleted: 7,
    backlogCount: 2,
    ongoingCount: 1,
    sentCount: 13,
    performanceScore: 88,
  },
];

// Generate dummy requests
const clientNames = [
  'IKEA France',
  'IKEA Germany',
  'IKEA UK',
  'IKEA Spain',
  'IKEA Italy',
  'IKEA Netherlands',
  'IKEA Belgium',
  'IKEA Sweden',
  'IKEA Norway',
  'IKEA Denmark',
];

const designs = [
  'PAX Wardrobe',
  'BESTÅ TV Unit',
  'KALLAX Shelf',
  'HEMNES Bed',
  'MALM Dresser',
  'BILLY Bookcase',
  'EKET Cabinet',
  'LACK Table',
];

const colors: { [key: string]: { haut?: string; bas?: string; colonne?: string } } = {
  'PAX Wardrobe': { haut: 'White', bas: 'White', colonne: 'Oak' },
  'BESTÅ TV Unit': { haut: 'Black-brown', bas: 'Black-brown' },
  'KALLAX Shelf': { haut: 'White', bas: 'White' },
  'HEMNES Bed': { haut: 'White', bas: 'White' },
  'MALM Dresser': { haut: 'Black-brown', bas: 'Black-brown' },
  'BILLY Bookcase': { haut: 'White', bas: 'White' },
  'EKET Cabinet': { haut: 'White', bas: 'White' },
  'LACK Table': { haut: 'Black-brown', bas: 'Black-brown' },
};

function generateDummyRequests(): Request[] {
  const requests: Request[] = [];
  let requestNumber = 2300;

  // Generate requests with different statuses
  const statuses: RequestStatus[] = ['new', 'ongoing', 'correction', 'sent'];
  
  // Distribute requests across artists
  const artistIds = dummyArtists.map(a => a.id);
  
  for (let i = 0; i < 25; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const assignedTo = status === 'new' ? null : artistIds[Math.floor(Math.random() * artistIds.length)];
    const type: RequestType = Math.random() > 0.5 ? 'PP' : 'Client';
    const design = designs[Math.floor(Math.random() * designs.length)];
    const clientName = clientNames[Math.floor(Math.random() * clientNames.length)];
    
    // Generate date within last 30 days
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    
    requests.push({
      id: `req-${requestNumber}`,
      number: requestNumber++,
      clientName,
      type,
      date: date.toISOString(),
      status,
      assignedTo,
      price: Math.floor(Math.random() * 500) + 100,
      ikpLink: `https://ikp.ikea.com/request/${requestNumber - 1}`,
      design,
      colors: colors[design] || {},
      description: `3D rendering request for ${design} in ${clientName}. Please ensure high quality renders with proper lighting and materials.`,
      thumbnail: `/thumbnails/ikea-${Math.floor(Math.random() * 10) + 1}.jpg`,
      renders: [],
    });
  }

  return requests;
}

export const dummyRequests: Request[] = generateDummyRequests();

// Helper function to get requests by artist
export function getRequestsByArtist(artistId: string): Request[] {
  return dummyRequests.filter(req => req.assignedTo === artistId);
}

// Helper function to get requests by status
export function getRequestsByStatus(status: RequestStatus): Request[] {
  return dummyRequests.filter(req => req.status === status);
}



