import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

// --- Server Setup ---
const app = express();
const port = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- Gemini AI Client Initialization ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === "your_gemini_api_key_goes_here") {
  console.error("GEMINI_API_KEY environment variable not set correctly. The application will exit.");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });

// --- Prompt Engineering Logic (moved from frontend) ---
const singlePredictionSchema = {
  type: Type.OBJECT,
  properties: {
    timeframe: { type: Type.STRING, enum: ['15s', '30s', '60s'] },
    direction: { type: Type.STRING, enum: ['UP', 'DOWN'] },
    confidence: { type: Type.NUMBER },
    reasoning: { type: Type.STRING },
  },
  required: ['timeframe', 'direction', 'confidence', 'reasoning'],
};

const predictionSchema = {
    type: Type.ARRAY,
    items: singlePredictionSchema,
};

const formatAccuracyFeedback = (stats) => {
    let feedback = `**Recent Performance Feedback:**\nYour performance on recent predictions is being tracked to create a feedback loop. Use this to improve your accuracy.\n`;
    (['15s', '30s', '60s']).forEach(tf => {
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

const buildPrompt = (priceHistory, orderBookFeatures, accuracyStats, indicators) => {
  const { rsi, macd, bbands, stochastic } = indicators;
  let indicatorsText = 'Technical Indicator Data:\n';
  let hasIndicators = false;

  if (rsi !== null) { indicatorsText += `- RSI (14): ${rsi.toFixed(2)} (Values > 70 suggest overbought, < 30 suggest oversold)\n`; hasIndicators = true; }
  if (macd !== null) { indicatorsText += `- MACD Line: ${macd.macd.toFixed(4)}, Signal Line: ${macd.signal.toFixed(4)}, Histogram: ${macd.histogram.toFixed(4)}\n`; hasIndicators = true; }
  if (bbands !== null) { indicatorsText += `- Bollinger Bands: Upper=${bbands.upper.toFixed(2)}, Middle=${bbands.middle.toFixed(2)}, Lower=${bbands.lower.toFixed(2)}\n`; hasIndicators = true; }
  if (stochastic !== null) { indicatorsText += `- Stochastic Oscillator: %K=${stochastic.k.toFixed(2)}, %D=${stochastic.d.toFixed(2)} (> 80 overbought, < 20 oversold)\n`; hasIndicators = true; }
  if (!hasIndicators) { indicatorsText = 'No technical indicator data available due to insufficient price history.'; }
  
  let orderBookText = 'No order book data available.';
  if (orderBookFeatures) {
    orderBookText = `Real-time Order Book Snapshot:\n- Mid Price: ${orderBookFeatures.mid_price.toFixed(4)}\n- Spread (Best Ask - Best Bid): ${orderBookFeatures.spread.toFixed(4)}\n- Top 10 Bids Volume: ${orderBookFeatures.bid_vol.toFixed(2)} ETH\n- Top 10 Asks Volume: ${orderBookFeatures.ask_vol.toFixed(2)} ETH\n- Order Book Imbalance: ${orderBookFeatures.imbalance.toFixed(4)} (Positive means more buy pressure, negative means more sell pressure)\n- Volume-Weighted Mid Price: ${orderBookFeatures.weighted_mid.toFixed(4)}`;
  }

  const accuracyFeedbackText = formatAccuracyFeedback(accuracyStats);
  const formattedHistory = priceHistory.map(p => ({ time: new Date(p.timestamp).toISOString(), price: p.price, high: p.high, low: p.low }));

  return \`
    You are a sophisticated quantitative trading model AI, trained on vast amounts of historical ETH/USDT tick data, order book states, and technical indicators. Your purpose is to simulate the output of a predictive machine learning model that continuously learns and improves.

    Analyze the following real-time data snapshot and provide a prediction for the next 15s, 30s, and 60s. Your analysis must synthesize signals from all provided data sources and incorporate feedback on your recent performance.

    \${accuracyFeedbackText}

    **Data Sources for Current Prediction:**
    1.  **Price Action & Volatility (last 60s):** 1-second OHLC data. Look for trends, momentum, and consolidation patterns.
    2.  **Technical Indicators:** RSI, MACD, Bollinger Bands, Stochastic Oscillator. Identify overbought/oversold conditions, momentum shifts, and trend strength.
    3.  **Order Book Microstructure:** A snapshot of current buy/sell pressure. This is a critical leading indicator.

    **Prediction Task:**
    For each timeframe (15s, 30s, 60s), provide a directional prediction (UP/DOWN), a confidence score, and a quantitative reasoning.

    **CRITICAL INSTRUCTIONS FOR REASONING:**
    - Your reasoning MUST be quantitative and specific.
    - Emulate the logic of a trained model by citing specific data points that justify your prediction.
    - Combine at least two different data sources in your reasoning. For example: "Strong buy pressure (imbalance=\${orderBookFeatures?.imbalance.toFixed(4)}) coupled with an upward-trending MACD histogram (\${macd?.histogram.toFixed(4)}) suggests continued short-term momentum." OR "Despite an overbought RSI (\${rsi?.toFixed(2)}), the significant bid volume (\${orderBookFeatures?.bid_vol.toFixed(2)} ETH) provides strong support, limiting downside risk."
    - Do NOT give generic advice. Base your reasoning entirely on the numbers provided below.

    Return your analysis as a JSON array of three objects, matching the specified schema.

    **Real-time Data Snapshot:**

    Price Data (last 60s, ohlc):
    \${JSON.stringify(formattedHistory.slice(-60))}

    \${indicatorsText}
    
    \${orderBookText}
  \`;
};

// --- API Endpoint ---
app.post('/api/predict', async (req, res) => {
  try {
    const { priceHistory, orderBookFeatures, accuracyStats, indicators } = req.body;

    if (!priceHistory || !accuracyStats || !indicators) {
        return res.status(400).json({ message: "Missing required data: priceHistory, accuracyStats, and indicators are required." });
    }

    const prompt = buildPrompt(priceHistory, orderBookFeatures, accuracyStats, indicators);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: predictionSchema,
      },
    });
    
    const jsonText = response.text.trim();
    const predictions = JSON.parse(jsonText);

    res.status(200).json(predictions);

  } catch (error) {
    console.error('Error in /api/predict endpoint:', error);
    const errorMessage = error.message || 'An unknown error occurred';
    // Check for specific error messages that indicate rate limiting
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('resource has been exhausted')) {
        return res.status(429).json({ message: 'Rate limit reached from Gemini API.', details: errorMessage });
    }
    res.status(500).json({ message: 'Failed to get prediction from AI.', details: errorMessage });
  }
});


// --- Server Start ---
app.listen(port, () => {
  console.log(\`Backend server listening on port \${port}\`);
});
