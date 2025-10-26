import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800/30 border-t border-gray-700 mt-8">
      <div className="container mx-auto px-4 md:px-6 py-4 text-center text-gray-500 text-sm">
        <p>
          Powered by React, Tailwind CSS, and a Secure Backend.
        </p>
        <p className="mt-1">
          Disclaimer: This is a simulation for demonstration purposes and not financial advice.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
