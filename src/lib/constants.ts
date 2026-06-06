/**
 * Shared constants for the Lab44 application.
 * Extracted from duplicated definitions across multiple components.
 */

// ─── Announcement Category Config ─────────────────────────────────────────────

export const ANNOUNCEMENT_CATEGORIES: Record<string, { label: string; color: string }> = {
  general: { label: 'General', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  exam: { label: 'Exam', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  lab: { label: 'Lab', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  deadline: { label: 'Deadline', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  other: { label: 'Other', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
};

export const VALID_ANNOUNCEMENT_CATEGORIES = Object.keys(ANNOUNCEMENT_CATEGORIES);

// ─── Resource Link Category Config ────────────────────────────────────────────

export const RESOURCE_CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  general: { label: 'General', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-900/30' },
  documentation: { label: 'Documentation', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  tutorial: { label: 'Tutorial', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  tool: { label: 'Tool', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  reference: { label: 'Reference', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  video: { label: 'Video', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
};

export const RESOURCE_CATEGORY_OPTIONS = Object.entries(RESOURCE_CATEGORY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  color: cfg.color,
  bg: cfg.bg,
}));

// ─── Announcement Reaction Display ────────────────────────────────────────────

export const REACTION_DISPLAY: Record<string, { label: string; color: string }> = {
  thumbs_up: { label: 'Like', color: 'text-emerald-600 dark:text-emerald-400' },
  acknowledged: { label: 'Acknowledged', color: 'text-blue-600 dark:text-blue-400' },
  thumbs_down: { label: 'Dislike', color: 'text-red-600 dark:text-red-400' },
  question: { label: 'Question', color: 'text-amber-600 dark:text-amber-400' },
  seen: { label: 'Seen', color: 'text-gray-600 dark:text-gray-400' },
};

// ─── VM Template Colors ───────────────────────────────────────────────────────

export const TEMPLATE_COLORS: Record<string, string> = {
  ubuntu: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  debian: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  centos: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  fedora: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  windows: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  kali: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  alpine: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

// ─── Password Strength Config ─────────────────────────────────────────────────

export const PASSWORD_STRENGTH = [
  { min: 0, label: 'Very Weak', color: 'bg-red-500', textColor: 'text-red-500' },
  { min: 1, label: 'Weak', color: 'bg-orange-500', textColor: 'text-orange-500' },
  { min: 2, label: 'Fair', color: 'bg-amber-500', textColor: 'text-amber-500' },
  { min: 3, label: 'Good', color: 'bg-emerald-500', textColor: 'text-emerald-500' },
  { min: 4, label: 'Strong', color: 'bg-emerald-600', textColor: 'text-emerald-600' },
  { min: 5, label: 'Very Strong', color: 'bg-emerald-700', textColor: 'text-emerald-700' },
];
