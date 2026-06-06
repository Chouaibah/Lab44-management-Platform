import { useState, useEffect, useRef } from 'react';

export function useAnimatedNumber(target: number, duration = 800): number {
    const [current, setCurrent] = useState(target);
    const rafRef = useRef<number>(0);
    const prevTargetRef = useRef<number>(target);

    useEffect(() => {
        // If target becomes 0, immediately snap to avoid negative animations
        if (target === 0) {
            setCurrent(0);
            prevTargetRef.current = 0;
            return;
        }

        const startValue = prevTargetRef.current;
        const startTime = Date.now();

        const step = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setCurrent(Math.round(startValue + eased * (target - startValue)));
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                prevTargetRef.current = target;
            }
        };

        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
    }, [target, duration]);

    return current;
}
