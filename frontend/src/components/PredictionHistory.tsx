import React from 'react';
import { PredictionResult } from '../types';

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


interface PredictionHistoryProps {
  history: PredictionResult[];
}

const PredictionHistory: React.FC<PredictionHistoryProps> = ({ history }) => {
  // Group predictions by timestamp to get unique prediction times
  const uniqueTimestamps: Record<number, PredictionResult[]> = history.reduce((acc, p) => {
    if (!acc[p.timestamp]) {
      acc[p.timestamp] = [];
    }
    acc[p.timestamp].push(p);
    return acc;
  }, {} as Record<number, PredictionResult[]>);

  // Get the most recent prediction time for each entry in the history array
  const historyWithUniqueTime = history.map(p => ({
    ...p,
    isFirst: uniqueTimestamps[p.timestamp][0] === p,
  }));

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Prediction History</h3>
      {history.length === 0 ? (
        <p className="text-center text-gray-500 text-sm">No past predictions yet.</p>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 sticky top-0">
              <tr>
                <th scope="col" className="px-4 py-3">Time</th>
                <th scope="col" className="px-4 py-3">Timeframe</th>
                <th scope="col" className="px-4 py-3">Direction</th>
                <th scope="col" className="px-4 py-3">Confidence</th>
                <th scope="col" className="px-4 py-3 min-w-[200px]">Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {historyWithUniqueTime.map((prediction, index) => {
                const isUp = prediction.direction === 'UP';
                const colorClass = isUp ? 'text-green-400' : 'text-red-400';
                const Icon = isUp ? ArrowUpIcon : ArrowDownIcon;
                const time = new Date(prediction.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                return (
                  <tr key={`${prediction.timestamp}-${prediction.timeframe}-${index}`} className="hover:bg-gray-800/40">
                    <td className="px-4 py-2 font-mono text-gray-400">
                      {prediction.isFirst ? time : ''}
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-200">{prediction.timeframe}</td>
                    <td className={`px-4 py-2 font-bold ${colorClass}`}>
                      <div className="flex items-center gap-2">
                        <Icon />
                        <span>{prediction.direction}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-200">
                      {(prediction.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-gray-400 italic text-xs">
                      "{prediction.reasoning}"
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PredictionHistory;
