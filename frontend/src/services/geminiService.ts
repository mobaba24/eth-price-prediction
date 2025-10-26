import { AiPrediction, PriceData, OrderBookFeatureData, AccuracyStats } from '../types';

// The function now calls our own backend, not the Gemini API directly.
// The backend will securely handle the API key and communication with Gemini.
const BACKEND_API_URL = '/api/predict'; // This will be proxied by Nginx in a production setup, or works with CORS in dev.

export const getEthPricePrediction = async (
    priceHistory: PriceData[],
    orderBookFeatures: OrderBookFeatureData | null,
    accuracyStats: AccuracyStats
): Promise<AiPrediction[]> => {
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceHistory,
        orderBookFeatures,
        accuracyStats,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Backend returned status: ${response.status}`);
    }

    const predictions: AiPrediction[] = await response.json();
    
    // Basic validation
    if (!Array.isArray(predictions)) {
        throw new Error("Backend did not return the expected array of predictions.");
    }

    return predictions;

  } catch (error) {
    console.error("Error calling backend service:", error);
    // Re-throw a more user-friendly error
    if (error instanceof Error && error.message.includes('rate limit')) {
        throw error;
    }
    throw new Error('Failed to fetch prediction from the backend server.');
  }
};
