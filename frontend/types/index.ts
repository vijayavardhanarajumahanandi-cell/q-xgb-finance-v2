export interface NavItem {
  href: string;
  label: string;
  icon: string;
  section?: string;
}

export interface HistoryItem {
  id: string;
  createdAt: string;
  prediction: string;
  confidence: number;
  instrument: string;
  timeframe: string;
  xgb: number;
  vqc: number;
  hybrid: number;
  topDriver: string;
  mode: string;
}
