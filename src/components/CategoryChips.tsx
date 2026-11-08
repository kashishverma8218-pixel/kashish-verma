import React from 'react';
import { CATEGORIES } from '../data/mockData';

interface CategoryChipsProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="sticky top-14 z-20 w-full bg-white/95 py-2.5 backdrop-blur-md dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="flex items-center gap-2 overflow-x-auto px-4 sm:px-6 scrollbar-none no-scrollbar">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
};
