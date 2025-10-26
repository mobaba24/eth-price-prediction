
import { GoogleGenAI, Type } from "@google/genai";
import { PriceData, AiPrediction, OrderBookFeatureData, AccuracyStats } from '../types';
import { calculateRSI, calculateMACD, calculateBBands, calculateStochastic } from '../utils/technicalIndicators';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const singlePredictionSchema = {
  type: Type.OBJECT,
  properties: {
    timeframe: {
        type: Type.STRING,
        enum: ['15s', '30s', '60s'],
        description: 'The prediction timeframe: 15 seconds, 30 seconds, or 60 seconds.',
    },
    direction: {
      type: Type.STRING,
      enum: ['UP', 'DOWN'],
      description: 'The predicted direction of the price movement.',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'A confidence score for the prediction, from 0.0 to 1.0.',
    },
    reasoning: {
      type: Type.STRING,
      description: 'A brief explanation for the prediction based on the data and technical indicators.',
    },
  },
  required: ['timeframe', 'direction', 'confidence', 'reasoning'],
};

const predictionSchema = {
    type: Type.ARRAY,
    items: singlePredictionSchema,
};

const formatAccuracyFeedback = (stats: AccuracyStats): string => {
    let feedback = `**Recent Performance Feedback:**
Your performance on recent predictions is being tracked to create a feedback loop. Use this to improve your accuracy.
`;
    (['15s', '30s', '60s'] as const).forEach(tf => {
        const stat = stats[tf];
        if (stat) {
            feedback += `- ${tf} Horizon: ${stat.correct}/${stat.total} correct (${(stat.accuracy * 100).toFixed(1)}% accuracy).\n`;
        } else {
            feedback += `- ${tf} Horizon: No completed predictions to analyze yet.\n`;
        }
    });

    feedback += `\n**Instruction:** Analyze your recent performance. If accuracy for a certain timeframe is low, be more cautious and adjust your confidence levels or reasoning. If accuracy is high, continue with your successful strategy. Your goal is to continuously improve.`;
    return feedback;
}

export const getEthPricePrediction = async (
    priceHistory: PriceData[], 
    orderBookFeatures: OrderBookFeatureData | null,
    accuracyStats: AccuracyStats
): Promise<AiPrediction[]> => {
  const prices = priceHistory.map(p => p.price);
  const highs = priceHistory.map(p => p.high);
  const lows = priceHistory.map(p => p.low);

  const rsi = calculateRSI(prices);
  const macd = calculateMACD(prices);
  const bbands = calculateBBands(prices);
  const stochastic = calculateStochastic(highs, lows, prices);

  let indicatorsText = 'Technical Indicator Data:\n';
  let hasIndicators = false;

  if (rsi !== null) {
    indicatorsText += `- RSI (14): ${rsi.toFixed(2)} (Values > 70 suggest overbought, < 30 suggest oversold)\n`;
    hasIndicators = true;
  }
  if (macd !== null) {
    indicatorsText += `- MACD Line: ${macd.macd.toFixed(4)}, Signal Line: ${macd.signal.toFixed(4)}, Histogram: ${macd.histogram.toFixed(4)}\n`;
    hasIndicators = true;
  }
  if (bbands !== null) {
    indicatorsText += `- Bollinger Bands: Upper=${bbands.upper.toFixed(2)}, Middle=${bbands.middle.toFixed(2)}, Lower=${bbands.lower.toFixed(2)}\n`;
    hasIndicators = true;
  }
  if (stochastic !== null) {
    indicatorsText += `- Stochastic Oscillator: %K=${stochastic.k.toFixed(2)}, %D=${stochastic.d.toFixed(2)} (> 80 overbought, < 20 oversold)\n`;
    hasIndicators = true;
  }

  if (!hasIndicators) {
    indicatorsText = 'No technical indicator data available due to insufficient price history.';
  }
  
  let orderBookText = 'No order book data available.';
  if (orderBookFeatures) {
    orderBookText = `
    Real-time Order Book Snapshot:
    - Mid Price: ${orderBookFeatures.mid_price.toFixed(4)}
    - Spread (Best Ask - Best Bid): ${orderBookFeatures.spread.toFixed(4)}
    - Top 10 Bids Volume: ${orderBookFeatures.bid_vol.toFixed(2)} ETH
    - Top 10 Asks Volume: ${orderBookFeatures.ask_vol.toFixed(2)} ETH
    - Order Book Imbalance: ${orderBookFeatures.imbalance.toFixed(4)} (Positive means more buy pressure, negative means more sell pressure)
    - Volume-Weighted Mid Price: ${orderBookFeatures.weighted_mid.toFixed(4)}
    `;
  }

  const accuracyFeedbackText = formatAccuracyFeedback(accuracyStats);

  const formattedHistory = priceHistory.map(p => ({ time: new Date(p.timestamp).toISOString(), price: p.price, high: p.high, low: p.low }));
  const prompt = `
    You are a sophisticated quantitative trading model AI, trained on vast amounts of historical ETH/USDT tick data, order book states, and technical indicators. Your purpose is to simulate the output of a predictive machine learning model that continuously learns and improves.

    Analyze the following real-time data snapshot and provide a prediction for the next 15s, 30s, and 60s. Your analysis must synthesize signals from all provided data sources and incorporate feedback on your recent performance.

    ${accuracyFeedbackText}

    **Data Sources for Current Prediction:**
    1.  **Price Action & Volatility (last 60s):** 1-second OHLC data. Look for trends, momentum, and consolidation patterns.
    2.  **Technical Indicators:** RSI, MACD, Bollinger Bands, Stochastic Oscillator. Identify overbought/oversold conditions, momentum shifts, and trend strength.
    3.  **Order Book Microstructure:** A snapshot of current buy/sell pressure. This is a critical leading indicator.

    **Prediction Task:**
    For each timeframe (15s, 30s, 60s), provide a directional prediction (UP/DOWN), a confidence score, and a quantitative reasoning.

    **CRITICAL INSTRUCTIONS FOR REASONING:**
    - Your reasoning MUST be quantitative and specific.
    - Emulate the logic of a trained model by citing specific data points that justify your prediction.
    - Combine at least two different data sources in your reasoning. For example: "Strong buy pressure (imbalance=${orderBookFeatures?.imbalance.toFixed(4)}) coupled with an upward-trending MACD histogram (${macd?.histogram.toFixed(4)}) suggests continued short-term momentum." OR "Despite an overbought RSI (${rsi?.toFixed(2)}), the significant bid volume (${orderBookFeatures?.bid_vol.toFixed(2)} ETH) provides strong support, limiting downside risk."
    - Do NOT give generic advice. Base your reasoning entirely on the numbers provided below.

    Return your analysis as a JSON array of three objects, matching the specified schema.

    **Real-time Data Snapshot:**

    Price Data (last 60s, ohlc):
    ${JSON.stringify(formattedHistory.slice(-60))}

    ${indicatorsText}
    
    ${orderBookText}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: predictionSchema,
      },
    });

    const jsonText = response.text.trim();
    const predictions = JSON.parse(jsonText) as AiPrediction[];

    // Basic validation
    if (!Array.isArray(predictions) || predictions.length === 0) {
        throw new Error("AI did not return the expected array of predictions.");
    }
    
    for (const p of predictions) {
        if (!['15s', '30s', '60s'].includes(p.timeframe) || !['UP', 'DOWN'].includes(p.direction) || typeof p.confidence !== 'number' || typeof p.reasoning !== 'string') {
            throw new Error("Invalid prediction format received from AI in one of the array items.");
        }
    }
    
    return predictions;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Re-throw the original error so the calling function can inspect its properties
    // (e.g., status code, message) for specific handling like rate-limiting.
    throw error;
  }
};
