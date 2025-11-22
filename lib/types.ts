// Accepter n'importe quelle string pour préserver les valeurs brutes de la spreadsheet
export type RequestStatus = string;

export type RequestType = 'PP' | 'Client';

export interface RequestColors {
  haut?: string;
  bas?: string;
  colonne?: string;
}

export interface Render {
  id: string;
  filename: string;
  url: string;
  uploadedAt: string;
}

export interface Request {
  id: string;
  number: number; // Format #2343
  clientName: string;
  ppName?: string; // Name of the PP (Plum Planner) if type is PP
  type: RequestType;
  date: string; // ISO date string
  status: RequestStatus;
  assignedTo: string | null; // artistId
  price: number;
  ikpLink: string;
  design: string;
  colors: RequestColors;
  description: string;
  thumbnail: string; // URL to thumbnail image
  renders: Render[];
  projectCode?: string; // Code UUID du projet depuis Typeform (pour mapping avec les prix)
}

export interface Artist {
  id: string;
  name: string;
  targetPerWeek: number;
  currentWeekCompleted: number;
  backlogCount: number;
  ongoingCount: number;
  sentCount: number;
  performanceScore: number; // 0-100
}

export interface ArtistBacklog {
  artist: Artist;
  requests: Request[];
}

export interface DashboardStats {
  totalRequests: number;
  ongoingRequests: number;
  sentRequests: number;
  backlogRequests: number;
}

