// Re‑export everything so existing imports from '@/lib/helpers' continue to work.

export { gradeColor, gradeBarColor, gradeDotColor } from './grades';
export { vmStatusBadge, attendanceStatusBadge } from './status-badges';
export { fmtDate, fmtDateTime, getInitials, getAvatarColor, todayDateStr } from './formatting';
export { getOSInfo } from './os-icons';
export type { OSIconInfo } from './os-icons';
export { HighlightMatch } from './highlight-match';
export { timeAgo } from './time-ago';
export { useAnimatedNumber } from './use-animated-number';
export { CircularProgress } from './circular-progress';
export { DotPattern } from './dot-pattern';
export { FloatingDecor } from './floating-decor';
export { StatCard } from './stat-card';
export { EmptyState } from './empty-state';
export { BreadcrumbNav } from './breadcrumb-nav';
export { AchievementBadge, computeAchievements } from './achievement-badge';
export { StudentAvatar } from './student-avatar';
export { parseBasicMarkdown } from './markdown-parser';
export { fadeSlide, staggerItem } from './animation-variants';
export { CHART_COLORS } from './chart-colors';

// ShimmerSkeleton was a simple wrapper; we can still re‑export it directly from the original Skeleton if desired.
// But to avoid breaking imports, we provide a proxy that does the same thing.
export { Skeleton as ShimmerSkeleton } from '@/components/ui/skeleton';