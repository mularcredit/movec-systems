import React from 'react';

interface CustomLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function CustomLoader({ message = 'Loading...', size = 'md' }: CustomLoaderProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const imgClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
        {/* Rotating border circle (solid arcs) */}
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-500 border-b-emerald-500 animate-spin" style={{ animationDuration: '2s' }}></div>
        
        {/* Rotating dotted border circle */}
        <div className="absolute inset-1.5 rounded-full border-[2px] border-dotted border-purple-400/80 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}></div>

        {/* Pulsing router image */}
        <img 
          src="/custom-loader.png" 
          alt="Loading router" 
          className={`${imgClasses[size]} object-contain animate-pulse drop-shadow-[0_0_10px_rgba(167,139,250,0.5)] z-10`} 
        />
      </div>
      
      {message && (
        <p className="text-[13px] font-medium text-textSecondary uppercase tracking-widest animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
