export const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
};

export const staggerItem = (index: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: {
    delay: 0.05 * index,
    duration: 0.25,
    ease: [0.25, 0.1, 0.25, 1] as const,
  },
});