import React from 'react';

const EthIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1.75l-6.25 10.5L12 16l6.25-3.75L12 1.75zM5.75 13.25L12 22.25l6.25-9-6.25 3.75-6.25-3.75z" />
    </svg>
);


const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
      <div className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center space-x-3">
          <EthIcon className="h-8 w-8 text-blue-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">
            ETH Price Predictor
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;
