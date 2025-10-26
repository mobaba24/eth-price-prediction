
import { OrderBookFeatureData } from '../types';

// Use an array of endpoints for resilience, similar to the price fetcher
const BINANCE_ENDPOINTS = [
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];
let currentEndpointIndex = 0;

type OrderBookLevel = [string, string]; // [price, quantity]

const getOrderBook = async (limit: number = 50): Promise<{ bids: OrderBookLevel[], asks: OrderBookLevel[] } | null> => {
    const endpoint = BINANCE_ENDPOINTS[currentEndpointIndex];
    const url = `${endpoint}/api/v3/depth?symbol=ETHUSDT&limit=${limit}`;
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) {
            console.error(`Failed to fetch order book from ${endpoint}: ${response.statusText}`);
            currentEndpointIndex = (currentEndpointIndex + 1) % BINANCE_ENDPOINTS.length;
            return null;
        }
        const data = await response.json();
        return { bids: data.bids, asks: data.asks };
    } catch (error) {
        console.error(`Error fetching order book from ${endpoint}:`, error);
        currentEndpointIndex = (currentEndpointIndex + 1) % BINANCE_ENDPOINTS.length;
        return null;
    }
}

export const getOrderBookFeatures = async (): Promise<OrderBookFeatureData | null> => {
    const orderBook = await getOrderBook();
    if (!orderBook) return null;

    try {
        const bids = orderBook.bids.map(([price, quantity]) => [parseFloat(price), parseFloat(quantity)]);
        const asks = orderBook.asks.map(([price, quantity]) => [parseFloat(price), parseFloat(quantity)]);

        if (bids.length === 0 || asks.length === 0) return null;

        const best_bid = bids[0][0];
        const best_ask = asks[0][0];

        const mid_price = (best_bid + best_ask) / 2;
        const spread = best_ask - best_bid;

        const bid_vol = bids.slice(0, 10).reduce((sum, level) => sum + level[1], 0);
        const ask_vol = asks.slice(0, 10).reduce((sum, level) => sum + level[1], 0);

        // Add a small epsilon to avoid division by zero
        const total_vol = bid_vol + ask_vol + 1e-9;
        const imbalance = (bid_vol - ask_vol) / total_vol;

        const weighted_mid = ((best_ask * bid_vol) + (best_bid * ask_vol)) / total_vol;

        return {
            mid_price,
            spread,
            bid_vol,
            ask_vol,
            imbalance,
            weighted_mid,
        };
    } catch (error) {
        console.error("Error calculating order book features:", error);
        return null;
    }
}
