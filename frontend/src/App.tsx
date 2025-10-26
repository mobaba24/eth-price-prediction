import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PriceData, PredictionResult, AiPrediction, OrderBookFeatureData, OrderBookPrediction, PredictionOutcome, AccuracyStats, OrderBookPredictionOutcome, OrderBookAccuracyStats } from './types';
import { getAiPrediction } from './services/aiService';
import { getOrderBookFeatures } from './services/orderbookService';
import PriceChart from './components/PriceChart';
import PredictionCard from './components/PredictionCard';
import PriceDisplay from './components/PriceDisplay';
import Header from './components/Header';
import Footer from './components/Footer';
import PredictionHistory from './components/PredictionHistory';
import OrderBookSignalCard from './components/OrderBookSignalCard';
import PerformanceTracker from './components/PerformanceTracker';

const MAX_HISTORY_LENGTH = 120; // Keep last 2 minutes of data (120 seconds)
const PREDICTION_INTERVAL = 30000; // 30 seconds
const RATE_LIMIT_COOLDOWN = 60000; // 60 seconds
const MAX_PREDICTION_HISTORY_ITEMS = 15;
const MAX_OUTCOME_HISTORY = 60; // Keep track of the last 60 individual predictions for accuracy stats

const BINANCE_ENDPOINTS = [
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];
const BYBIT_ENDPOINT = 'https://api.bybit.com/v5/market/tickers?category=spot&symbol=ETHUSDT';

const generateSmartOrderBookPrediction = (
  timeframe: '15s' | '30s' | '60s',
  currentFeatures: OrderBookFeatureData,
  previousFeatures: OrderBookFeatureData | null,
  priceChange: number,
  accuracy: { correct: number; total: number; accuracy: number; } | null
): OrderBookPrediction => {
  let baseDirection: OrderBookPrediction['direction'] = 'NEUTRAL';
  if (currentFeatures.imbalance > 0.05) baseDirection = 'UP';
  else if (currentFeatures.imbalance < -0.05) baseDirection = 'DOWN';

  let confidence = Math.abs(currentFeatures.imbalance) * 1.5;

  if (previousFeatures) {
    const imbalanceDelta = currentFeatures.imbalance - previousFeatures.imbalance;
    if ((imbalanceDelta > 0.01 && baseDirection === 'UP') || (imbalanceDelta < -0.01 && baseDirection === 'DOWN')) {
      confidence += 0.15;
    } else if ((imbalanceDelta < -0.01 && baseDirection === 'UP') || (imbalanceDelta > 0.01 && baseDirection === 'DOWN')) {
      confidence -= 0.15;
    }
  }

  const priceMomentumThreshold = 0.1;
  if ((priceChange > priceMomentumThreshold && baseDirection === 'UP') || (priceChange < -priceMomentumThreshold && baseDirection === 'DOWN')) {
    confidence += 0.1;
  } else if ((priceChange < -priceMomentumThreshold && baseDirection === 'UP') || (priceChange > priceMomentumThreshold && baseDirection === 'DOWN')) {
    confidence -= 0.2;
  }

  let finalDirection = baseDirection;
  if (confidence < 0.3) {
    finalDirection = 'NEUTRAL';
  }

  const finalConfidence = Math.max(0, Math.min(0.95, confidence));
  
  let confidenceDecay = 0;
  if (timeframe === '30s') confidenceDecay = 0.05;
  if (timeframe === '60s') confidenceDecay = 0.1;
  
  // Adaptive Learning: Adjust confidence based on historical accuracy
  let accuracyAdjustment = 0;
  if (accuracy && accuracy.total > 5) { // Only adjust after a few data points
      // Adjust based on deviation from 50% (chance), scaled by a small factor
      accuracyAdjustment = (accuracy.accuracy - 0.5) * 0.1; 
  }

  return {
    timeframe,
    direction: finalDirection,
    confidence: Math.max(0, Math.min(0.95, finalConfidence - confidenceDecay + accuracyAdjustment)),
    timestamp: Date.now(),
  };
};

const App: React.FC = () => {
  const [priceHistory, setPriceHistory] = useState<PriceData[]>([]);
  const [currentPredictions, setCurrentPredictions] = useState<PredictionResult[] | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<PredictionResult[]>([]);
  const [aiPredictionOutcomes, setAiPredictionOutcomes] = useState<PredictionOutcome[]>([]);
  const [orderBookOutcomes, setOrderBookOutcomes] = useState<OrderBookPredictionOutcome[]>([]);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEndpointIndex, setCurrentEndpointIndex] = useState(0);
  const [orderBookFeatures, setOrderBookFeatures] = useState<OrderBookFeatureData | null>(null);
  const [orderBookPredictions, setOrderBookPredictions] = useState<OrderBookPrediction[]>([
    { timeframe: '15s', direction: 'NEUTRAL', confidence: 0, timestamp: 0 },
    { timeframe: '30s', direction: 'NEUTRAL', confidence: 0, timestamp: 0 },
    { timeframe: '60s', direction: 'NEUTRAL', confidence: 0, timestamp: 0 },
  ]);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);

  const priceHistoryRef = useRef(priceHistory);
  priceHistoryRef.current = priceHistory;
  
  const orderBookFeaturesRef = useRef(orderBookFeatures);
  orderBookFeaturesRef.current = orderBookFeatures;

  const previousOrderBookFeaturesRef = useRef<OrderBookFeatureData | null>(null);

  const aiPredictionOutcomesRef = useRef(aiPredictionOutcomes);
  aiPredictionOutcomesRef.current = aiPredictionOutcomes;
  
  const orderBookOutcomesRef = useRef(orderBookOutcomes);
  orderBookOutcomesRef.current = orderBookOutcomes;

  const isRateLimitedRef = useRef(isRateLimited);
  isRateLimitedRef.current = isRateLimited;

  const rateLimitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      const currentBinanceEndpoint = BINANCE_ENDPOINTS[currentEndpointIndex];

      const fetchBinance = async () => {
        try {
          const response = await fetch(`${currentBinanceEndpoint}/api/v3/klines?symbol=ETHUSDT&interval=1s&limit=1`);
          if (!response.ok) {
            console.error(`Failed to fetch from Binance ${currentBinanceEndpoint}: ${response.statusText}`);
            setCurrentEndpointIndex(prev => (prev + 1) % BINANCE_ENDPOINTS.length);
            return null;
          }
          const data = await response.json();
          if (!data || data.length === 0) return null;
          const kline = data[0];
          return {
            timestamp: kline[0], price: parseFloat(kline[4]),
            high: parseFloat(kline[2]), low: parseFloat(kline[3]),
          };
        } catch (error) {
          console.error(`Error fetching from Binance ${currentBinanceEndpoint}:`, error);
          setCurrentEndpointIndex(prev => (prev + 1) % BINANCE_ENDPOINTS.length);
          return null;
        }
      };

      const fetchBybit = async (): Promise<number | null> => {
        try {
          const response = await fetch(BYBIT_ENDPOINT);
          if (!response.ok) return null;
          const data = await response.json();
          return parseFloat(data?.result?.list?.[0]?.lastPrice) || null;
        } catch (error) { return null; }
      };

      const fetchKucoin = async (): Promise<number | null> => {
        try {
          const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.kucoin.com/api/v1/market/stats?symbol=ETH-USDT')}`;
          const response = await fetch(proxiedUrl);
          if (!response.ok) return null;
          const data = await response.json();
          return parseFloat(data?.data?.last) || null;
        } catch (error) { return null; }
      };

      const [binanceResult, bybitPrice, kucoinPrice, features] = await Promise.all([
        fetchBinance(), fetchBybit(), fetchKucoin(), getOrderBookFeatures(),
      ]);
      
      previousOrderBookFeaturesRef.current = orderBookFeaturesRef.current;
      if (features) setOrderBookFeatures(features);

      const prices = [binanceResult?.price, bybitPrice, kucoinPrice].filter((p): p is number => p !== null && !isNaN(p));
      if (prices.length === 0) return;

      const averagePrice = prices.reduce((acc, p) => acc + p, 0) / prices.length;
      const newPriceData: PriceData = {
        timestamp: binanceResult ? binanceResult.timestamp : Date.now(),
        price: averagePrice,
        high: binanceResult ? binanceResult.high : averagePrice,
        low: binanceResult ? binanceResult.low : averagePrice,
      };
      
      setPriceHistory(prev => [...prev, newPriceData].slice(-MAX_HISTORY_LENGTH));
    };

    fetchMarketData();
    const intervalId = setInterval(fetchMarketData, 2000);
    return () => clearInterval(intervalId);
  }, [currentEndpointIndex]);

  const orderBookAccuracyStats = useMemo((): OrderBookAccuracyStats => {
    const stats: OrderBookAccuracyStats = { '15s': null, '30s': null, '60s': null };
    (['15s', '30s', '60s'] as const).forEach(tf => {
        const relevant = orderBookOutcomesRef.current.filter(o => o.prediction.timeframe === tf && o.prediction.direction !== 'NEUTRAL' && o.status !== 'PENDING');
        if (relevant.length > 0) {
            const correct = relevant.filter(o => o.status === 'CORRECT').length;
            stats[tf] = { correct, total: relevant.length, accuracy: correct / relevant.length };
        }
    });
    return stats;
  }, [orderBookOutcomes]);
  
  const accuracyStatsRef = useRef(orderBookAccuracyStats);
  accuracyStatsRef.current = orderBookAccuracyStats;

  useEffect(() => {
    const createPredictionLoop = (timeframe: '15s' | '30s' | '60s', interval: number) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const update = () => {
            const features = orderBookFeaturesRef.current;
            const prevFeatures = previousOrderBookFeaturesRef.current;
            const history = priceHistoryRef.current;
            const currentAccuracyStats = accuracyStatsRef.current;

            if (features && history.length > 1) {
                const priceChange = history.length > 1 ? history[history.length - 1].price - history[history.length - 2].price : 0;
                
                const newPrediction = generateSmartOrderBookPrediction(
                    timeframe,
                    features,
                    prevFeatures,
                    priceChange,
                    currentAccuracyStats[timeframe]
                );
                
                setOrderBookPredictions(prev => prev.map(p => (p.timeframe === timeframe ? newPrediction : p)));
                setOrderBookOutcomes(prev => [{ prediction: newPrediction, status: 'PENDING' as const }, ...prev].slice(0, MAX_OUTCOME_HISTORY));
            }
            timeoutId = setTimeout(update, interval);
        };

        timeoutId = setTimeout(update, 2500 + Math.random() * 500);

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    };

    const cleanup15s = createPredictionLoop('15s', 15000);
    const cleanup30s = createPredictionLoop('30s', 30000);
    const cleanup60s = createPredictionLoop('60s', 60000);

    return () => {
        cleanup15s();
        cleanup30s();
        cleanup60s();
    };
}, []);

  useEffect(() => {
    const latestPrice = priceHistory[priceHistory.length - 1]?.price;
    if (!latestPrice) return;

    const timeframeMap = { '15s': 15000, '30s': 30000, '60s': 60000 };

    const resolveAiOutcomes = () => {
      if (aiPredictionOutcomes.length === 0) return;
      const updatedOutcomes = aiPredictionOutcomes.map(outcome => {
        if (outcome.status === 'PENDING') {
          const { prediction } = outcome;
          if (Date.now() - prediction.timestamp >= timeframeMap[prediction.timeframe]) {
            const actualDirection = latestPrice > prediction.priceAtPrediction ? 'UP' : 'DOWN';
            const newStatus: 'CORRECT' | 'INCORRECT' = actualDirection === prediction.direction ? 'CORRECT' : 'INCORRECT';
            return { ...outcome, status: newStatus };
          }
        }
        return outcome;
      });
      if (JSON.stringify(updatedOutcomes) !== JSON.stringify(aiPredictionOutcomes)) {
        setAiPredictionOutcomes(updatedOutcomes);
      }
    };

    const resolveOrderBookOutcomes = () => {
        if (orderBookOutcomes.length === 0) return;
        const updatedOutcomes = orderBookOutcomes.map(outcome => {
            if (outcome.status === 'PENDING') {
                const { prediction } = outcome;
                if (Date.now() - prediction.timestamp >= timeframeMap[prediction.timeframe]) {
                    const priceAtPrediction = priceHistoryRef.current.find(p => p.timestamp >= prediction.timestamp)?.price;
                    if (priceAtPrediction === undefined) return outcome; // Not enough data yet to resolve
                    
                    if (prediction.direction === 'NEUTRAL') {
                        return { ...outcome, status: 'NEUTRAL' as const };
                    }
                    const actualDirection = latestPrice > priceAtPrediction ? 'UP' : 'DOWN';
                    const newStatus: 'CORRECT' | 'INCORRECT' = actualDirection === prediction.direction ? 'CORRECT' : 'INCORRECT';
                    return { ...outcome, status: newStatus };
                }
            }
            return outcome;
        });
        if (JSON.stringify(updatedOutcomes) !== JSON.stringify(orderBookOutcomes)) {
            setOrderBookOutcomes(updatedOutcomes);
        }
    };
    
    resolveAiOutcomes();
    resolveOrderBookOutcomes();

  }, [priceHistory, aiPredictionOutcomes, orderBookOutcomes]);


  const fetchPrediction = useCallback(async () => {
    if (isRateLimitedRef.current) return;
    
    const currentPriceHistory = priceHistoryRef.current;
    if (currentPriceHistory.length < 60) return;

    const accuracyStats: AccuracyStats = { '15s': null, '30s': null, '60s': null };
    (['15s', '30s', '60s'] as const).forEach(tf => {
        const relevant = aiPredictionOutcomesRef.current.filter(o => o.prediction.timeframe === tf && o.status !== 'PENDING');
        if (relevant.length > 0) {
            const correct = relevant.filter(o => o.status === 'CORRECT').length;
            accuracyStats[tf] = { correct, total: relevant.length, accuracy: correct / relevant.length };
        }
    });

    setIsPredicting(true);
    if (!isRateLimitedRef.current) setError(null);
    try {
      const results: AiPrediction[] = await getAiPrediction(currentPriceHistory, orderBookFeaturesRef.current, accuracyStats);
      const now = Date.now();
      const priceAtPrediction = currentPriceHistory[currentPriceHistory.length - 1]?.price;
      if (typeof priceAtPrediction !== 'number') throw new Error("Could not get current price for prediction.");

      const predictionsWithMetadata: PredictionResult[] = results.map(p => ({ ...p, timestamp: now, priceAtPrediction }));
      setCurrentPredictions(predictionsWithMetadata);
      setPredictionHistory(prev => [...predictionsWithMetadata, ...prev].slice(0, MAX_PREDICTION_HISTORY_ITEMS));
      setAiPredictionOutcomes(prev => [...predictionsWithMetadata.map(p => ({ prediction: p, status: 'PENDING' as const })), ...prev].slice(0, MAX_OUTCOME_HISTORY));

    } catch (err) {
      if (err instanceof Error && (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'))) {
        setError(`Rate limit reached. Predictions paused for ${RATE_LIMIT_COOLDOWN / 1000} seconds.`);
        setIsRateLimited(true);
        setCurrentPredictions(null);
        if (rateLimitTimeoutRef.current) clearTimeout(rateLimitTimeoutRef.current);
        rateLimitTimeoutRef.current = setTimeout(() => {
          setIsRateLimited(false);
          setError(null);
        }, RATE_LIMIT_COOLDOWN);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to get prediction: ${errorMessage}`);
        setCurrentPredictions(null);
      }
    } finally {
      setIsPredicting(false);
    }
  }, []);

  useEffect(() => {
    const initialTimeout = setTimeout(() => {
      fetchPrediction();
      const intervalId = setInterval(fetchPrediction, PREDICTION_INTERVAL);
      return () => clearInterval(intervalId);
    }, 5000);
    return () => {
        clearTimeout(initialTimeout);
        if (rateLimitTimeoutRef.current) clearTimeout(rateLimitTimeoutRef.current);
    };
  }, [fetchPrediction]);
  
  const currentPriceData = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null;
  const previousPriceData = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2] : null;
  const priceChange = currentPriceData && previousPriceData ? currentPriceData.price - previousPriceData.price : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2 flex flex-col gap-6 md:gap-8">
            <div className="bg-gray-800/50 rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700">
              <h2 className="text-xl md:text-2xl font-bold text-gray-200 mb-4">ETH/USDT Price (1s)</h2>
              <div className="h-64 md:h-96">
                <PriceChart data={priceHistory} />
              </div>
            </div>
             <OrderBookSignalCard predictions={orderBookPredictions} />
            <div className="bg-gray-800/50 rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700">
              <PredictionHistory history={predictionHistory} />
            </div>
          </div>
          <div className="flex flex-col gap-6 md:gap-8">
            <div className="bg-gray-800/50 rounded-xl shadow-2xl p-6 border border-gray-700">
              <PriceDisplay 
                currentPrice={currentPriceData?.price} 
                priceChange={priceChange} 
              />
            </div>
            <div className="bg-gray-800/50 rounded-xl shadow-2xl p-6 border border-gray-700">
              <PredictionCard 
                predictions={currentPredictions}
                isLoading={isPredicting}
                error={error}
              />
            </div>
             <div className="bg-gray-800/50 rounded-xl shadow-2xl p-6 border border-gray-700">
              <PerformanceTracker outcomes={orderBookOutcomes} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default App;
