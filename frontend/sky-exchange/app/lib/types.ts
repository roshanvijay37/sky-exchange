export interface Match {
  id: number;
  sport: string;
  teamA: string;
  teamB: string;
  startTime: string;
  status: string;
}

export interface Odd {
  id: number;
  outcome: string;
  backPrice: number;
  layPrice: number;
  isLocked: boolean;
}

export interface Market {
  id: number;
  name: string;
  status: string;
  odds: Odd[];
}

export interface OrderBookEntry {
  side: string;
  price: number;
  totalStake: number;
  count: number;
}

export interface Position {
  id: number;
  side: string;
  price: number;
  stake: number;
  status: string;
  outcome: string;
  createdAt: string;
}

export interface TradeHistory {
  id: number;
  match: string;
  outcome: string;
  side: string;
  price: number;
  stake: number;
  pnl: number;
  pnlStatus: string;
  createdAt: string;
}
