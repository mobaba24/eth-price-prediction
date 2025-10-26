const calculateEMASeries = (prices: number[], period: number) : (number|null)[] | null => {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  const emas: (number|null)[] = Array(prices.length).fill(null);
  
  let sum = 0;
  for(let i = 0; i < period; i++) sum += prices[i];
  emas[period-1] = sum / period;

  for(let i = period; i < prices.length; i++) {
      const prevEma = emas[i-1];
      if (prevEma !== null) {
          emas[i] = (prices[i] * k) + (prevEma * (1-k));
      }
  }
  return emas;
}

const calculateSMA = (data: number[], period: number): number | null => {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
};

const calculateStdDev = (data: number[], period: number): number | null => {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const mean = calculateSMA(slice, period);
    if (mean === null) return null;
    const sqDiff = slice.map(price => Math.pow(price - mean, 2));
    const avgSqDiff = sqDiff.reduce((a, b) => a + b, 0) / period;
    return Math.sqrt(avgSqDiff);
};

/**
 * Calculates Bollinger Bands values for a series of prices.
 * @returns An object with upper, middle, lower bands, or null.
 */
export const calculateBBands = (prices: number[], period: number = 20, stdDevMultiplier: number = 2) => {
    if (prices.length < period) return null;
    
    const middle = calculateSMA(prices, period);
    const stdDev = calculateStdDev(prices, period);

    if (middle === null || stdDev === null) return null;

    return {
        upper: middle + (stdDev * stdDevMultiplier),
        middle: middle,
        lower: middle - (stdDev * stdDevMultiplier),
    };
};

/**
 * Calculates the Stochastic Oscillator values.
 * @returns An object with %K and %D, or null.
 */
export const calculateStochastic = (
    highs: number[], 
    lows: number[], 
    closes: number[], 
    kPeriod: number = 14, 
    dPeriod: number = 3
): { k: number, d: number } | null => {
    if (closes.length < kPeriod) return null;

    const kValues: number[] = [];
    for (let i = kPeriod - 1; i < closes.length; i++) {
        const sliceHighs = highs.slice(i - kPeriod + 1, i + 1);
        const sliceLows = lows.slice(i - kPeriod + 1, i + 1);
        const highestHigh = Math.max(...sliceHighs);
        const lowestLow = Math.min(...sliceLows);
        const currentClose = closes[i];

        if (highestHigh === lowestLow) {
            kValues.push(100); // Avoid division by zero
        } else {
            const k = 100 * ((currentClose - lowestLow) / (highestHigh - lowestLow));
            kValues.push(k);
        }
    }
    
    if (kValues.length < dPeriod) return null;

    const lastK = kValues[kValues.length - 1];
    const dSlice = kValues.slice(-dPeriod);
    const lastD = dSlice.reduce((a, b) => a + b, 0) / dPeriod;

    return {
        k: lastK,
        d: lastD,
    };
};

/**
 * Calculates the final RSI value for a series of prices.
 * @param prices Array of numbers representing closing prices.
 * @param period The period for RSI calculation (default 14).
 * @returns The last RSI value, or null if there's not enough data.
 */
export const calculateRSI = (prices: number[], period: number = 14): number | null => {
  if (prices.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  // Calculate initial average gains and losses
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change; // losses are positive values
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smooth the averages for the rest of the data
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
  }

  if (avgLoss === 0) {
    return 100; // RSI is 100 if average loss is 0
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

/**
 * Calculates the final MACD values for a series of prices.
 * @param prices Array of numbers representing closing prices.
 * @returns An object with the last macd, signal, and histogram values, or null.
 */
export const calculateMACD = (prices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (prices.length < slowPeriod + signalPeriod) {
    return null;
  }

  const ema12 = calculateEMASeries(prices, fastPeriod);
  const ema26 = calculateEMASeries(prices, slowPeriod);
  
  if (!ema12 || !ema26) return null;
  
  const macdLineSeries: (number | null)[] = prices.map((_, i) => {
      if (ema12[i] !== null && ema26[i] !== null) {
          return ema12[i]! - ema26[i]!;
      }
      return null;
  });
  
  const validMacdValues = macdLineSeries.filter(v => v !== null) as number[];
  if(validMacdValues.length < signalPeriod) return null;
  
  const signalLineEMASeries = calculateEMASeries(validMacdValues, signalPeriod);
  if(!signalLineEMASeries) return null;

  const validSignalValues = signalLineEMASeries.filter(v => v !== null) as number[];
  if(validSignalValues.length === 0) return null;
  
  const lastMacd = validMacdValues[validMacdValues.length - 1];
  const lastSignal = validSignalValues[validSignalValues.length-1];

  if (lastMacd === undefined || lastSignal === undefined) return null;
  
  return {
      macd: lastMacd,
      signal: lastSignal,
      histogram: lastMacd - lastSignal,
  };
};
