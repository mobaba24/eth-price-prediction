

export interface PriceData {
  timestamp: number;
  price: number; // Represents close price
  high: number;
  low: number;
}

export type PredictionDirection = 'UP' | 'DOWN';

export interface AiPrediction {
  timeframe: '15s' | '30s' | '60s';
  direction: PredictionDirection;
  confidence: number;
  reasoning: string;
}

export interface PredictionResult extends AiPrediction {
  timestamp: number;
  priceAtPrediction: number;
}

export interface OrderBookFeatureData {
  mid_price: number;
  spread: number;
  bid_vol: number;
  ask_vol: number;
  imbalance: number;
  weighted_mid: number;
}

export type OrderBookPredictionDirection = 'UP' | 'DOWN' | 'NEUTRAL';

export type OrderBookTimeframe = '5s' | '15s' | '30s' | '60s';

export interface OrderBookPrediction {
  timeframe: OrderBookTimeframe;
  direction: OrderBookPredictionDirection;
  confidence: number;
  timestamp: number;
}

export interface PredictionOutcome {
  prediction: PredictionResult;
  status: 'PENDING' | 'CORRECT' | 'INCORRECT';
}

export interface OrderBookPredictionOutcome {
  prediction: OrderBookPrediction;
  status: 'PENDING' | 'CORRECT' | 'INCORRECT' | 'NEUTRAL';
}


export type AccuracyStats = Record<
  '15s' | '30s' | '60s', 
  { correct: number; total: number; accuracy: number; } | null
>;

export type OrderBookAccuracyStats = Record<
  OrderBookTimeframe, 
  { correct: number; total: number; accuracy: number; } | null
>;

export interface ImbalanceData {
  timestamp: number;
  imbalance: number;
}
