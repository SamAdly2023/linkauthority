
export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  points: number;
  websites: Website[];
  phone?: string;
  avatar?: string;
  referralCode?: string;
  rating?: number;
  reviewCount?: number;
  isAdmin?: boolean;
}

export interface Website {
  id: string;
  url: string;
  domainAuthority: number;
  category: string;
  serviceType?: 'local' | 'worldwide';
  location?: {
    country?: string;
    state?: string;
    city?: string;
  };
  verified?: boolean;
  isVerified?: boolean;
  verificationToken?: string;
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
  AIExpert = 'aiexpert',
  Guide = 'guide',
  Profile = 'profile',
  AdminUsers = 'admin_users',
  AdminWebsites = 'admin_websites',
  AdminTransactions = 'admin_transactions',
  AdminSettings = 'admin_settings'
}
