import React from 'react';

interface PriceDisplayProps {
  currentPrice?: number;
  priceChange: number;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({ currentPrice, priceChange }) => {
  const priceChangeColor = priceChange > 0 ? 'text-green-400' : priceChange < 0 ? 'text-red-400' : 'text-gray-400';
  const priceChangeSign = priceChange > 0 ? '+' : '';

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-400 mb-2">Current Price</h3>
      <p className="text-4xl md:text-5xl font-bold tracking-tight text-white">
        {currentPrice !== undefined ? `$${currentPrice.toFixed(2)}` : 'Loading...'}
      </p>
      <p className={`text-xl font-medium mt-2 ${priceChangeColor}`}>
        {currentPrice !== undefined ? `${priceChangeSign}${priceChange.toFixed(2)}` : '-'}
      </p>
    </div>
  );
};

export default PriceDisplay;
