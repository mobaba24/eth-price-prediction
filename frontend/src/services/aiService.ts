import { AiPrediction, PriceData, OrderBookFeatureData, AccuracyStats } from '../types';
import { calculateRSI, calculateMACD, calculateBBands, calculateStochastic } from '../utils/technicalIndicators';

const BACKEND_API_URL = '/api/predict';

export const getAiPrediction = async (
    priceHistory: PriceData[],
    orderBookFeatures: OrderBookFeatureData | null,
    accuracyStats: AccuracyStats
): Promise<AiPrediction[]> => {
  try {
    // Calculate indicators on the client-side and send them to the backend
    const prices = priceHistory.map(p => p.price);
    const highs = priceHistory.map(p => p.high);
    const lows = priceHistory.map(p => p.low);

    const indicators = {
      rsi: calculateRSI(prices),
      macd: calculateMACD(prices),
      bbands: calculateBBands(prices),
      stochastic: calculateStochastic(highs, lows, prices),
    };

    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceHistory: priceHistory.slice(-60), // Send only last 60s
        orderBookFeatures,
        accuracyStats,
        indicators,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Backend returned status: ${response.status}`}));
        const errorMessage = errorData.details || errorData.message || `An unknown error occurred. Status: ${response.status}`;
        
        // Specific check for rate limit error from our backend
        if (response.status === 429 || errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('exhausted')) {
             throw new Error("429: Rate limit reached.");
        }
        throw new Error(errorMessage);
    }

    const predictions: AiPrediction[] = await response.json();
    
    // Basic validation
    if (!Array.isArray(predictions)) {
        throw new Error("Backend did not return the expected array of predictions.");
    }

    return predictions;

  } catch (error) {
    console.error("Error calling backend service:", error);
    // Re-throw the error so the UI can handle it
    throw error;
  }
};
