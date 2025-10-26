import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import OpenAI from 'openai';

// --- Server Setup ---
const app = express();
const port = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- OpenAI Client Initialization ---
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey === "your_openai_api_key_goes_here") {
  console.error("OPENAI_API_KEY environment variable not set correctly. The application will exit.");
  process.exit(1);
}
const openai = new OpenAI({ apiKey });

// --- Prompt Engineering Logic for OpenAI ---

const formatAccuracyFeedback = (stats) => {
    let feedback = `Your performance on recent predictions is being tracked to create a feedback loop. Use this to improve your accuracy.\n`;
    (['15s', '30s', '60s']).forEach(tf => {
        const stat = stats[tf];
        if (stat) {
            feedback += `- ${tf} Horizon: ${stat.correct}/${stat.total} correct (${(stat.accuracy * 100).toFixed(1)}% accuracy).\n`;
        } else {
            feedback += `- ${tf} Horizon: No completed predictions to analyze yet.\n`;
        }
    });
    return feedback;
}

const buildPromptMessages = (priceHistory, orderBookFeatures, accuracyStats, indicators) => {
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
  
  const systemPrompt = `You are a sophisticated quantitative trading model AI, trained on vast amounts of historical ETH/USDT tick data, order book states, and technical indicators. Your purpose is to simulate the output of a predictive machine learning model that continuously learns and improves.

Your analysis must synthesize signals from all provided data sources and incorporate feedback on your recent performance.

**CRITICAL RESPONSE FORMAT:**
You MUST return your analysis as a single JSON object. The object must have a single key named "predictions". The value of "predictions" must be an array of exactly three objects, one for each timeframe (15s, 30s, 60s).

Each object in the "predictions" array must have the following keys:
- "timeframe": (string) The prediction timeframe: "15s", "30s", or "60s".
- "direction": (string) The predicted direction: "UP" or "DOWN".
- "confidence": (number) A confidence score from 0.0 to 1.0.
- "reasoning": (string) A brief, quantitative explanation for the prediction, combining at least two data sources. For example: "Strong buy pressure (imbalance=${orderBookFeatures?.imbalance.toFixed(4)}) coupled with an upward-trending MACD histogram (${macd?.histogram.toFixed(4)}) suggests continued short-term momentum."

Do NOT give generic advice. Base your reasoning entirely on the numbers provided.
`;

const userPrompt = `Analyze the following real-time data snapshot and provide your predictions in the required JSON format.

**Recent Performance Feedback:**
${accuracyFeedbackText}
**Instruction:** Analyze your recent performance. If accuracy for a certain timeframe is low, be more cautious and adjust your confidence levels or reasoning. If accuracy is high, continue with your successful strategy. Your goal is to continuously improve.

**Real-time Data Snapshot:**

Price Data (last 60s, ohlc):
${JSON.stringify(formattedHistory.slice(-60))}

${indicatorsText}
    
${orderBookText}
`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
};

// --- API Endpoint ---
app.post('/api/predict', async (req, res) => {
  try {
    const { priceHistory, orderBookFeatures, accuracyStats, indicators } = req.body;

    if (!priceHistory || !accuracyStats || !indicators) {
        return res.status(400).json({ message: "Missing required data: priceHistory, accuracyStats, and indicators are required." });
    }

    const messages = buildPromptMessages(priceHistory, orderBookFeatures, accuracyStats, indicators);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      response_format: { type: "json_object" },
    });
    
    const jsonText = completion.choices[0].message.content;
    const result = JSON.parse(jsonText);
    const predictions = result.predictions;

    // Validate the final structure before sending
    if (!predictions || !Array.isArray(predictions)) {
      throw new Error("AI response did not contain a valid 'predictions' array.");
    }

    res.status(200).json(predictions);

  } catch (error) {
    console.error('Error in /api/predict endpoint:', error);
    const errorMessage = error.message || 'An unknown error occurred';
    
    if (error.status === 429) {
        return res.status(429).json({ message: 'Rate limit reached from OpenAI API.', details: errorMessage });
    }
    res.status(500).json({ message: 'Failed to get prediction from AI.', details: errorMessage });
  }
});


// --- Server Start ---
app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
