import { useEffect, useRef, useState } from 'react';
import { useInView, motion, useSpring, useTransform } from 'framer-motion';

interface Props {
  value: number;
  duration?: number;
  formatFn?: (n: number) => string;
  className?: string;
}

export default function CountUp({ value, duration = 1.5, formatFn, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState('0');

  const spring = useSpring(0, { duration: duration * 1000 });
  const rounded = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, value, spring]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => {
      setDisplayValue(formatFn ? formatFn(v) : String(v));
    });
    return unsubscribe;
  }, [rounded, formatFn]);

  return (
    <motion.span ref={ref} className={className}>
      {displayValue}
    </motion.span>
  );
}
