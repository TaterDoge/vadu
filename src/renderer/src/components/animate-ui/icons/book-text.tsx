"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type BookTextProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    title1: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        transition: { delay: 0.05, duration: 0.4, ease: "easeOut" },
      },
      initial: { opacity: 1, pathLength: 1 },
    },
    title2: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        transition: { delay: 0.4, duration: 0.35, ease: "easeOut" },
      },
      initial: { opacity: 1, pathLength: 1 },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: BookTextProps) {
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
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <motion.path
        animate={controls}
        d="M8 7h6"
        initial="initial"
        variants={variants.title1}
      />
      <motion.path
        animate={controls}
        d="M8 11h8"
        initial="initial"
        variants={variants.title2}
      />
    </motion.svg>
  );
}

function BookText(props: BookTextProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  BookText,
  BookText as BookTextIcon,
  type BookTextProps,
  type BookTextProps as BookTextIconProps,
  animations,
};
