/**
 * Revenue Sharing Logic for Vio streaming Platform
 * Implements strict revenue split: 30% to creator, 70% to platform owner based on total earnings.
 */

export interface RevenueSplitResult {
  totalEarnings: number;
  creatorShare: number;
  platformShare: number;
  creatorPercentage: number; // 30%
  platformPercentage: number; // 70%
  formattedTotal: string;
  formattedCreatorShare: string;
  formattedPlatformShare: string;
}

/**
 * Calculates the revenue split based on total earnings.
 * 30% goes to the content creator, 70% goes to the platform owner.
 *
 * @param totalEarnings - The gross revenue earned (USD)
 * @returns RevenueSplitResult with exact breakdown and formatted strings
 */
export function calculateRevenueSplit(totalEarnings: number): RevenueSplitResult {
  const safeTotal = Math.max(0, Number(totalEarnings) || 0);

  // Exact 30% creator, 70% platform
  const CREATOR_RATIO = 0.30;
  const PLATFORM_RATIO = 0.70;

  const creatorShare = Number((safeTotal * CREATOR_RATIO).toFixed(2));
  // Subtract creatorShare from total to guarantee sum equality without floating point pennies
  const platformShare = Number((safeTotal - creatorShare).toFixed(2));

  const formatCurrency = (val: number): string =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  return {
    totalEarnings: safeTotal,
    creatorShare,
    platformShare,
    creatorPercentage: 30,
    platformPercentage: 70,
    formattedTotal: formatCurrency(safeTotal),
    formattedCreatorShare: formatCurrency(creatorShare),
    formattedPlatformShare: formatCurrency(platformShare),
  };
}

/**
 * Estimates gross earnings from video views and applies the 30% creator / 70% platform split.
 * 
 * @param views - Total view count
 * @param rpm - Revenue per 1,000 views (Default $2.50 RPM)
 */
export function estimateEarningsFromViews(views: number, rpm: number = 2.50): RevenueSplitResult {
  const safeViews = Math.max(0, Number(views) || 0);
  const estimatedGross = Number(((safeViews / 1000) * rpm).toFixed(2));
  return calculateRevenueSplit(estimatedGross);
}
