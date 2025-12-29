
export interface User {
  id: string;
  name: string;
  email: string;
  points: number;
  websites: Website[];
}

export interface Website {
  id: string;
  url: string;
  domainAuthority: number;
  category: string;
  verified: boolean;
}

export interface Transaction {
  id: string;
  _id?: string;
  type: 'earn' | 'spend';
  points: number;
  sourceUrl: string;
  targetUrl: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  verificationUrl?: string;
}

export enum Tab {
  Dashboard = 'dashboard',
  Marketplace = 'marketplace',
  MySites = 'mysites',
  History = 'history',
  AIExpert = 'aiexpert'
}
