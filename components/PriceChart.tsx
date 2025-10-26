
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PriceData } from '../types';

interface PriceChartProps {
  data: PriceData[];
}

const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500">Waiting for price data...</div>;
  }

  const formatXAxis = (tickItem: number) => {
    return new Date(tickItem).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  const yDomain = [
    Math.min(...data.map(d => d.price)) - 5,
    Math.max(...data.map(d => d.price)) + 5,
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
        <XAxis 
          dataKey="timestamp" 
          tickFormatter={formatXAxis} 
          stroke="#A0AEC0"
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis 
          domain={yDomain} 
          stroke="#A0AEC0" 
          tick={{ fontSize: 12 }} 
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(26, 32, 44, 0.8)',
            borderColor: '#4A5568',
            borderRadius: '0.5rem',
          }}
          labelStyle={{ color: '#E2E8F0', fontWeight: 'bold' }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
          labelFormatter={(label) => new Date(label).toLocaleString()}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="price" 
          stroke="#4299E1" 
          strokeWidth={2} 
          dot={false}
          name="ETH Price"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default PriceChart;
