import React from 'react';

interface CustomLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

export default function CustomLoader({ message = 'Loading...', size = 'md', inline = false }: CustomLoaderProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const imgClasses = {
    sm: 'w-5 h-5',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  if (inline) {
    return (
      <div className="relative inline-flex items-center justify-center">
        {/* Radial glow background */}
        <div className="absolute inset-0 bg-purple-500/30 blur-md rounded-full z-0 animate-pulse"></div>
        
        <img 
          src="/modem.png" 
          alt="Loading..." 
          className={`${imgClasses[size]} object-contain animate-heartbeat drop-shadow-[0_0_8px_rgba(167,139,250,0.8)] relative z-10`} 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
        {/* Deep radial glow behind the image */}
        <div className="absolute inset-2 bg-purple-500/20 blur-xl rounded-full z-0 animate-pulse"></div>

        {/* Rotating border circle (solid arcs) */}
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-500 border-b-emerald-500 animate-spin" style={{ animationDuration: '2s' }}></div>
        
        {/* Rotating dotted border circle */}
        <div className="absolute inset-1.5 rounded-full border-[2px] border-dotted border-purple-400/80 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}></div>

        {/* Pulsing router image */}
        <img 
          src="/modem.png" 
          alt="Loading..." 
          className={`${imgClasses[size]} object-contain animate-heartbeat drop-shadow-[0_0_15px_rgba(167,139,250,0.8)] relative z-10`} 
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
