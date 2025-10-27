

import React, { useState, useEffect, useRef } from 'react';
import { OrderBookPrediction } from '../types';
import CountdownCircle from './CountdownCircle';

interface OrderBookSignalCardProps {
  predictions: OrderBookPrediction[] | null;
}

const ArrowUpIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
    </svg>
);

const ArrowDownIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
    </svg>
);

const NeutralIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 12h16" />
    </svg>
);

const initialCountdowns = {
    '5s': 5,
    '15s': 15,
    '30s': 30,
    '60s': 60,
};

type CountdownState = typeof initialCountdowns;

const OrderBookSignalCard: React.FC<OrderBookSignalCardProps> = ({ predictions }) => {
    const [countdowns, setCountdowns] = useState<CountdownState>(initialCountdowns);
    const prevTimestampsRef = useRef<Record<string, number>>({});

    // This effect RESETS a countdown only when its specific prediction is new
    useEffect(() => {
        if (predictions) {
            let hasChanged = false;
            const newCountdowns = { ...countdowns };

            predictions.forEach(p => {
                const timeframeKey = p.timeframe as keyof CountdownState;
                if (p.timestamp !== 0 && prevTimestampsRef.current[timeframeKey] !== p.timestamp) {
                    newCountdowns[timeframeKey] = initialCountdowns[timeframeKey];
                    hasChanged = true;
                }
            });

            if (hasChanged) {
                setCountdowns(newCountdowns);
                // Update the ref with the latest timestamps
                prevTimestampsRef.current = predictions.reduce((acc, p) => {
                    acc[p.timeframe] = p.timestamp;
                    return acc;
                }, {} as Record<string, number>);
            }
        }
    }, [predictions]);

    // This effect DECREMENTS the countdowns every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdowns(prev => ({
                '5s': Math.max(0, prev['5s'] - 1),
                '15s': Math.max(0, prev['15s'] - 1),
                '30s': Math.max(0, prev['30s'] - 1),
                '60s': Math.max(0, prev['60s'] - 1),
            }));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const renderPredictionBox = (prediction: OrderBookPrediction) => {
        const signalInfo = {
            'UP': { icon: ArrowUpIcon, color: 'text-green-400' },
            'DOWN': { icon: ArrowDownIcon, color: 'text-red-400' },
            'NEUTRAL': { icon: NeutralIcon, color: 'text-gray-400' },
        }[prediction.direction];

        const Icon = signalInfo.icon;
        
        const timeframeKey = prediction.timeframe as keyof CountdownState;
        const currentCountdown = countdowns[timeframeKey];
        const totalSeconds = initialCountdowns[timeframeKey];

        return (
             <div key={prediction.timeframe} className="relative bg-gray-900/50 p-4 rounded-lg text-center flex flex-col justify-between h-full min-h-[120px]">
                <div className="absolute top-3 right-3">
                    <CountdownCircle seconds={currentCountdown} totalSeconds={totalSeconds} />
                </div>
                <div>
                    <p className="text-md font-bold text-gray-300">{prediction.timeframe}</p>
                    <div className={`flex items-center justify-center gap-2 text-3xl font-bold mt-2 ${signalInfo.color}`}>
                        <Icon />
                        <span>{prediction.direction}</span>
                    </div>
                </div>
                <p className="text-sm text-gray-300 mt-3">
                    Confidence: <span className="font-semibold text-white">{(prediction.confidence * 100).toFixed(1)}%</span>
                </p>
            </div>
        )
    }

  return (
    <div className="bg-gray-800/50 rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-gray-200 mb-4 text-center">Order Book Pressure Prediction</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {predictions ? (
            [...predictions]
              .sort((a,b) => parseInt(a.timeframe) - parseInt(b.timeframe))
              .map(renderPredictionBox)
        ) : (
            [...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-900/50 p-4 rounded-lg text-center animate-pulse h-32">
                     <div className="h-5 bg-gray-700 rounded w-1/3 mx-auto"></div>
                     <div className="h-8 bg-gray-700 rounded w-3/4 mx-auto mt-3"></div>
                     <div className="h-4 bg-gray-700 rounded w-1/2 mx-auto mt-4"></div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default OrderBookSignalCard;