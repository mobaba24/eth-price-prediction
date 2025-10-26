
import React, { useMemo } from 'react';
import { OrderBookPredictionOutcome } from '../types';

interface PerformanceTrackerProps {
  outcomes: OrderBookPredictionOutcome[];
}

const PerformanceTracker: React.FC<PerformanceTrackerProps> = ({ outcomes }) => {

  const accuracyStats = useMemo(() => {
    const stats: Record<'15s' | '30s' | '60s', { correct: number; total: number; accuracy: number }> = {
      '15s': { correct: 0, total: 0, accuracy: 0 },
      '30s': { correct: 0, total: 0, accuracy: 0 },
      '60s': { correct: 0, total: 0, accuracy: 0 },
    };

    const completedDirectionalOutcomes = outcomes.filter(o => o.status !== 'PENDING' && o.prediction.direction !== 'NEUTRAL');

    for (const outcome of completedDirectionalOutcomes) {
      const timeframe = outcome.prediction.timeframe;
      stats[timeframe].total++;
      if (outcome.status === 'CORRECT') {
        stats[timeframe].correct++;
      }
    }

    for (const key in stats) {
        const timeframe = key as keyof typeof stats;
        if (stats[timeframe].total > 0) {
            stats[timeframe].accuracy = stats[timeframe].correct / stats[timeframe].total;
        }
    }

    return stats;
  }, [outcomes]);

  const renderStat = (timeframe: '15s' | '30s' | '60s') => {
    const stat = accuracyStats[timeframe];
    const accuracyPercent = (stat.accuracy * 100).toFixed(1);

    return (
      <div key={timeframe}>
        <div className="flex justify-between items-baseline text-sm">
          <span className="font-bold text-gray-300">{timeframe} Horizon</span>
          <span className="font-mono text-gray-400">{stat.correct} / {stat.total}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5 my-1">
          <div 
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-500" 
            style={{ width: `${stat.accuracy * 100}%` }}
          ></div>
        </div>
        <p className="text-right text-lg font-bold text-white">{stat.total > 0 ? `${accuracyPercent}%` : 'N/A'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className='text-center mb-4'>
        <h3 className="text-lg font-semibold text-gray-200">Order Book Model Performance</h3>
        <p className="text-xs text-gray-400 mt-1">Model confidence is adaptively adjusted based on this accuracy data.</p>
      </div>
      <div className="flex-grow flex flex-col justify-center space-y-4 px-1">
        {renderStat('15s')}
        {renderStat('30s')}
        {renderStat('60s')}
      </div>
    </div>
  );
};

export default PerformanceTracker;
