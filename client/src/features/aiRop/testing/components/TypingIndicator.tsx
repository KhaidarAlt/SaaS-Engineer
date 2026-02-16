import { motion } from "framer-motion";

interface TypingIndicatorProps {
  visible?: boolean;
}

const dotVariants = {
  animate: (i: number) => ({
    y: [0, -6, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      delay: i * 0.15,
      ease: "easeInOut",
    },
  }),
};

export function TypingIndicator({ visible = true }: TypingIndicatorProps) {
  if (!visible) return null;

  return (
    <div data-testid="typing-indicator" className="flex justify-start">
      <div className="bg-white dark:bg-[#1F2C34] rounded-lg px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            custom={i}
            variants={dotVariants}
            animate="animate"
            className="block w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
          />
        ))}
      </div>
    </div>
  );
}
