"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type RefreshCwProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      animate: {
        rotate: 45,
        transition: { damping: 25, stiffness: 150, type: "spring" },
      },
      initial: {
        rotate: 0,
        transition: { damping: 25, stiffness: 150, type: "spring" },
      },
    },
    path1: {},
    path2: {},
    path3: {},
    path4: {},
  } satisfies Record<string, Variants>,
  rotate: {
    group: {
      animate: {
        rotate: 360,
        transition: { damping: 25, stiffness: 100, type: "spring" },
      },
      initial: {
        rotate: 0,
        transition: { damping: 25, stiffness: 100, type: "spring" },
      },
    },
    path1: {},
    path2: {},
    path3: {},
    path4: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: RefreshCwProps) {
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
      <motion.path
        animate={controls}
        d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
        initial="initial"
        variants={variants.path1}
      />
      <motion.path
        animate={controls}
        d="M21 3v5h-5"
        initial="initial"
        variants={variants.path2}
      />
      <motion.path
        animate={controls}
        d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
        initial="initial"
        variants={variants.path3}
      />
      <motion.path
        animate={controls}
        d="M8 16H3v5"
        initial="initial"
        variants={variants.path4}
      />
    </motion.svg>
  );
}

function RefreshCw(props: RefreshCwProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  RefreshCw,
  RefreshCw as RefreshCwIcon,
  type RefreshCwProps,
  type RefreshCwProps as RefreshCwIconProps,
  animations,
};
