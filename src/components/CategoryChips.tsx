import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../data/mockData';
import { useLanguage } from '../context/LanguageContext';

interface CategoryChipsProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  const scrollByAmount = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="sticky top-14 z-20 w-full bg-[var(--bg)]/95 backdrop-blur-md py-2 sm:py-2.5 transition-colors">
      <div className="relative flex items-center">
        {canScrollLeft && (
          <div className="hidden sm:flex items-center absolute left-0 top-0 bottom-0 z-10 pl-2 pr-6 bg-gradient-to-r from-[var(--bg)] via-[var(--bg)]/90 to-transparent">
            <button
              type="button"
              onClick={() => scrollByAmount(-260)}
              aria-label="Scroll categories left"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg)] hover:bg-[var(--card-hover)] text-[var(--ink)] border border-[var(--ink-faint)] shadow-sm transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-center gap-2 overflow-x-auto px-3.5 sm:px-6 scrollbar-none no-scrollbar w-full"
        >
          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onSelectCategory(category)}
                className={`rounded-lg h-8 px-3 text-[13.5px] font-medium whitespace-nowrap shrink-0 transition-colors inline-flex items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--ink)] text-[var(--bg)] font-semibold'
                    : 'bg-[var(--card-hover)] text-[var(--ink)] hover:bg-[var(--ink-faint)]'
                }`}
              >
                {t(`cat.${category}`, category)}
              </button>
            );
          })}
        </div>

        {canScrollRight && (
          <div className="hidden sm:flex items-center absolute right-0 top-0 bottom-0 z-10 pr-2 pl-6 bg-gradient-to-l from-[var(--bg)] via-[var(--bg)]/90 to-transparent">
            <button
              type="button"
              onClick={() => scrollByAmount(260)}
              aria-label="Scroll categories right"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg)] hover:bg-[var(--card-hover)] text-[var(--ink)] border border-[var(--ink-faint)] shadow-sm transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
