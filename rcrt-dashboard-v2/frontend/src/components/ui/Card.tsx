import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export type CardType = 'tool' | 'secret' | 'agent' | 'breadcrumb' | 'provider' | 'config';

export interface CardProps {
  type: CardType;
  icon?: string;
  title: string;
  description?: string;
  tags?: string[];
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  metadata?: Record<string, any>;
}

/**
 * Shared Card component that matches the existing dashboard node styles
 * Extracted from Node2D.tsx for consistency across Quick Start and dynamic pages
 */
export function Card({
  type,
  icon,
  title,
  description,
  tags = [],
  selected = false,
  onClick,
  className,
  children,
  metadata
}: CardProps) {
  const getCardStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      cursor: onClick ? 'pointer' : 'default',
      userSelect: 'none',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease',
      position: 'relative',
      zIndex: 1,
    };

    switch (type) {
      case 'tool':
      case 'provider':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 245, 255, 0.1) 100%)',
          border: `2px solid ${selected ? '#00ff88' : 'rgba(0, 255, 136, 0.4)'}`,
          borderRadius: '12px',
          width: '110px',
          height: '110px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          overflow: 'hidden',
        };

      case 'secret':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(255, 99, 132, 0.1) 0%, rgba(255, 64, 129, 0.1) 100%)',
          border: `2px solid ${selected ? '#ff6384' : 'rgba(255, 99, 132, 0.4)'}`,
          borderRadius: '8px',
          width: '130px',
          height: '90px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          overflow: 'hidden',
        };

      case 'agent':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
          border: `2px solid ${selected ? '#9333ea' : 'rgba(147, 51, 234, 0.5)'}`,
          borderRadius: '12px',
          width: '160px',
          height: '110px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px',
          overflow: 'hidden',
        };

      case 'breadcrumb':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(0, 128, 255, 0.1) 100%)',
          border: `1px solid ${selected ? '#00f5ff' : 'rgba(0, 245, 255, 0.3)'}`,
          borderRadius: '12px',
          padding: '12px',
          width: '280px',
          height: '120px',
          overflow: 'hidden',
        };

      case 'config':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
          border: `2px solid ${selected ? '#3b82f6' : 'rgba(59, 130, 246, 0.4)'}`,
          borderRadius: '12px',
          width: '140px',
          height: '100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px',
          overflow: 'hidden',
        };

      default:
        return baseStyles;
    }
  };

  const getHoverEffects = () => {
    switch (type) {
      case 'tool':
      case 'provider':
        return {
          boxShadow: '0 6px 20px rgba(0, 255, 136, 0.25)',
          scale: 1.05,
          zIndex: 10,
        };
      case 'secret':
        return {
          boxShadow: '0 6px 20px rgba(255, 99, 132, 0.25)',
          scale: 1.05,
          zIndex: 10,
        };
      case 'agent':
        return {
          boxShadow: '0 8px 30px rgba(147, 51, 234, 0.4)',
          scale: 1.08,
          zIndex: 10,
        };
      case 'breadcrumb':
        return {
          boxShadow: '0 8px 25px rgba(0, 245, 255, 0.15)',
          y: -2,
          zIndex: 10,
        };
      case 'config':
        return {
          boxShadow: '0 6px 20px rgba(59, 130, 246, 0.25)',
          scale: 1.05,
          zIndex: 10,
        };
      default:
        return {};
    }
  };

  const renderCardContent = () => {
    if (children) {
      return children;
    }

    // Default rendering based on type
    if (type === 'tool' || type === 'provider') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          {icon && <div className="text-2xl mb-2">{icon}</div>}
          <div className="text-green-400 font-bold text-xs mb-1 line-clamp-2">
            {title}
          </div>
          {description && (
            <div className="text-white/70 text-xs line-clamp-2">
              {description}
            </div>
          )}
        </div>
      );
    }

    if (type === 'secret') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          {icon && <div className="text-xl mb-1">{icon}</div>}
          <div className="text-red-400 font-bold text-xs mb-1 line-clamp-1">
            {title}
          </div>
          {description && (
            <div className="text-white/70 text-xs line-clamp-2">
              {description}
            </div>
          )}
        </div>
      );
    }

    if (type === 'agent') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          {icon && <div className="text-xl mb-1">{icon}</div>}
          <div className="text-purple-400 font-bold text-xs mb-1 line-clamp-2">
            {title}
          </div>
          {description && (
            <div className="text-white/70 text-xs line-clamp-2 leading-tight">
              {description}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.slice(0, 2).map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === 'config') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          {icon && <div className="text-xl mb-1">{icon}</div>}
          <div className="text-blue-400 font-bold text-xs mb-1 line-clamp-2">
            {title}
          </div>
          {description && (
            <div className="text-white/70 text-xs line-clamp-2">
              {description}
            </div>
          )}
        </div>
      );
    }

    // Default/breadcrumb rendering
    return (
      <div className="w-full h-full flex flex-col">
        <div className="text-white font-semibold text-sm mb-2 line-clamp-1">
          {title}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2 flex-1 overflow-hidden">
            {tags.map(tag => (
              <span
                key={tag}
                className="bg-blue-500/20 text-blue-300 text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {description && (
          <div className="text-xs text-gray-400 mt-auto">
            {description}
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      style={getCardStyles()}
      className={clsx('card', className)}
      onClick={onClick}
      whileHover={onClick ? getHoverEffects() : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {renderCardContent()}
    </motion.div>
  );
}

