import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ImbalanceData } from '../types';

interface ImbalanceChartProps {
  data: ImbalanceData[];
}

const ImbalanceChart: React.FC<ImbalanceChartProps> = ({ data }) => {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500">Waiting for order book data...</div>;
  }

  const formatXAxis = (tickItem: number) => {
    return new Date(tickItem).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const gradientOffset = () => {
    const dataMax = Math.max(...data.map((i) => i.imbalance));
    const dataMin = Math.min(...data.map((i) => i.imbalance));

    if (dataMax <= 0) {
      return 0;
    }
    if (dataMin >= 0) {
      return 1;
    }

    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
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
          domain={[-0.5, 0.5]}
          stroke="#A0AEC0" 
          tick={{ fontSize: 12 }} 
          tickFormatter={(value) => value.toFixed(2)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(26, 32, 44, 0.8)',
            borderColor: '#4A5568',
            borderRadius: '0.5rem',
          }}
          labelStyle={{ color: '#E2E8F0', fontWeight: 'bold' }}
          formatter={(value: number) => [value.toFixed(4), 'Imbalance']}
          labelFormatter={(label) => new Date(label).toLocaleString()}
        />
        <defs>
          <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset={off} stopColor="#22c55e" stopOpacity={0.8}/> {/* green-500 */}
            <stop offset={off} stopColor="#ef4444" stopOpacity={0.8}/> {/* red-500 */}
          </linearGradient>
        </defs>
        <ReferenceLine y={0} stroke="#A0AEC0" strokeDasharray="2 2" />
        <Area 
          type="monotone" 
          dataKey="imbalance" 
          stroke="url(#splitColor)"
          fill="url(#splitColor)"
          strokeWidth={2} 
          dot={false}
          name="Order Book Imbalance"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default ImbalanceChart;
