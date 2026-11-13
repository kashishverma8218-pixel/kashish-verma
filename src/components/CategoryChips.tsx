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
    <div className="sticky top-14 z-20 w-full bg-[var(--bg)]/95 backdrop-blur-md py-3 transition-colors">
      <div className="flex items-center gap-2.5 overflow-x-auto px-4 sm:px-6 scrollbar-none no-scrollbar">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`rounded-lg h-8 px-3 text-[13.5px] font-medium whitespace-nowrap shrink-0 transition-colors inline-flex items-center justify-center ${
                isSelected
                  ? 'bg-[var(--ink)] text-[var(--bg)] font-semibold'
                  : 'bg-[var(--card-hover)] text-[var(--ink)] hover:bg-[var(--ink-faint)]'
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
