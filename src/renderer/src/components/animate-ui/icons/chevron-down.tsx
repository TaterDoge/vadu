"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type ChevronDownProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path: {
      animate: {
        transition: { duration: 0.3, ease: "easeInOut" },
        y: 4,
      },
      initial: {
        transition: { duration: 0.3, ease: "easeInOut" },
        y: 0,
      },
    },
  } satisfies Record<string, Variants>,
  "default-loop": {
    path: {
      animate: {
        transition: { duration: 0.6, ease: "easeInOut" },
        y: [0, 4, 0],
      },
      initial: {
        y: 0,
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ChevronDownProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <motion.path
        animate={controls}
        d="m6 9 6 6 6-6"
        initial="initial"
        variants={variants.path}
      />
    </motion.svg>
  );
}

function ChevronDown(props: ChevronDownProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  ChevronDown,
  ChevronDown as ChevronDownIcon,
  type ChevronDownProps,
  type ChevronDownProps as ChevronDownIconProps,
  animations,
};
