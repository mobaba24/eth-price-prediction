import React from 'react';
import { PredictionResult } from '../types';

interface PredictionCardProps {
  predictions: PredictionResult[] | null;
  isLoading: boolean;
  error: string | null;
}

const ArrowUpIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
    </svg>
);

const ArrowDownIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
    </svg>
);

const PredictionCard: React.FC<PredictionCardProps> = ({ predictions, isLoading, error }) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-3 w-full">
          {/* Skeleton for Header */}
          <div className="grid grid-cols-12 gap-2 font-bold text-transparent text-xs uppercase px-2">
              <div className="col-span-2 bg-gray-700 h-4 rounded"></div>
              <div className="col-span-3 bg-gray-700 h-4 rounded"></div>
              <div className="col-span-7 bg-gray-700 h-4 rounded"></div>
          </div>
           {/* Skeleton for Body */}
          {[...Array(3)].map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-900/50 p-2 rounded-md h-12">
                  <div className="col-span-2 bg-gray-700 h-5 rounded"></div>
                  <div className="col-span-3 bg-gray-700 h-5 rounded"></div>
                  <div className="col-span-7 bg-gray-700 h-5 rounded"></div>
              </div>
          ))}
        </div>
      );
    }

    if (error) {
        return <p className="text-center text-red-400">{error}</p>;
    }
    
    if (!predictions || predictions.length === 0) {
      return <p className="text-center text-gray-500">Awaiting first prediction...</p>;
    }
    
    const sortedPredictions = [...predictions].sort((a, b) => parseInt(a.timeframe) - parseInt(b.timeframe));

    return (
      <div className="space-y-2 w-full text-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 font-bold text-gray-400 text-xs uppercase px-2 pb-1 border-b border-gray-700">
            <div className="col-span-2">Time</div>
            <div className="col-span-3">Direction</div>
            <div className="col-span-7">Reasoning & Conf.</div>
        </div>

        {/* Table Body */}
        {sortedPredictions.map((prediction) => {
            const isUp = prediction.direction === 'UP';
            const colorClass = isUp ? 'text-green-400' : 'text-red-400';
            const Icon = isUp ? ArrowUpIcon : ArrowDownIcon;

            return (
                <div key={prediction.timeframe} className="grid grid-cols-12 gap-2 items-start bg-gray-800/40 p-2 rounded-md">
                    <div className="col-span-2 font-bold text-gray-200 pt-1">{prediction.timeframe}</div>
                    <div className={`col-span-3 flex items-center gap-1.5 font-bold ${colorClass} pt-1`}>
                        <Icon />
                        <span>{prediction.direction}</span>
                    </div>
                    <div className="col-span-7">
                        <p className="text-xs text-gray-400 italic">"{prediction.reasoning}"</p>
                        <p className="text-xs text-gray-300 font-medium mt-1">
                            Confidence: <span className="font-semibold text-white">{(prediction.confidence * 100).toFixed(1)}%</span>
                        </p>
                    </div>
                </div>
            );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-200 mb-4 text-center">AI Predictions</h3>
      <div className="flex-grow flex items-center justify-center px-1">
        {renderContent()}
      </div>
    </div>
  );
};

export default PredictionCard;