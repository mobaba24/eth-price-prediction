import React from 'react';

interface CountdownCircleProps {
  seconds: number;
  totalSeconds: number;
  size?: number;
  strokeWidth?: number;
}

const CountdownCircle: React.FC<CountdownCircleProps> = ({
  seconds,
  totalSeconds,
  size = 32,
  strokeWidth = 3,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / totalSeconds;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="absolute top-0 left-0" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#4A5568" // gray-600
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#4299E1" // blue-400
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s linear',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-200">
        {seconds}
      </div>
    </div>
  );
};

export default CountdownCircle;
