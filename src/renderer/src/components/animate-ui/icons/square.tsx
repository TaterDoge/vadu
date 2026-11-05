"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type SquareProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    body: {},
    group: {
      animate: {
        scale: [1, 0.9, 1.08, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
      initial: { scale: 1 },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: SquareProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      animate={controls}
      fill="none"
      height={size}
      initial="initial"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      variants={variants.group}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <motion.rect
        animate={controls}
        height={18}
        initial="initial"
        rx={2}
        variants={variants.body}
        width={18}
        x={3}
        y={3}
      />
    </motion.svg>
  );
}

function Square(props: SquareProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Square,
  Square as SquareIcon,
  type SquareProps,
  type SquareProps as SquareIconProps,
  animations,
};
