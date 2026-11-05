"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type FrameProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    line1: {
      animate: {
        transition: { damping: 15, stiffness: 150, type: "spring" },
        y: -4,
      },
      initial: {
        transition: { damping: 15, stiffness: 150, type: "spring" },
        y: 0,
      },
    },
    line2: {
      animate: {
        transition: { damping: 15, stiffness: 150, type: "spring" },
        y: 4,
      },
      initial: {
        transition: { damping: 15, stiffness: 150, type: "spring" },
        y: 0,
      },
    },
    line3: {
      animate: {
        transition: { damping: 15, stiffness: 150, type: "spring" },
        x: -4,
      },
      initial: {
        transition: { damping: 15, stiffness: 150, type: "spring" },
        x: 0,
      },
    },
    line4: {
      animate: {
        transition: { damping: 15, stiffness: 150, type: "spring" },
        x: 4,
      },
      initial: {
        transition: { damping: 15, stiffness: 150, type: "spring" },
        x: 0,
      },
    },
  } satisfies Record<string, Variants>,
  "default-loop": {
    line1: {
      animate: {
        transition: { duration: 0.8, ease: "easeInOut" },
        y: [0, -4, 0],
      },
      initial: {
        transition: { duration: 0.8, ease: "easeInOut" },
        y: 0,
      },
    },
    line2: {
      animate: {
        transition: { duration: 0.8, ease: "easeInOut" },
        y: [0, 4, 0],
      },
      initial: {
        transition: { duration: 0.8, ease: "easeInOut" },
        y: 0,
      },
    },
    line3: {
      animate: {
        transition: { duration: 0.8, ease: "easeInOut" },
        x: [0, -4, 0],
      },
      initial: {
        transition: { duration: 0.8, ease: "easeInOut" },
        x: 0,
      },
    },
    line4: {
      animate: {
        transition: { duration: 0.8, ease: "easeInOut" },
        x: [0, 4, 0],
      },
      initial: {
        transition: { duration: 0.8, ease: "easeInOut" },
        x: 0,
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: FrameProps) {
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
      <motion.line
        animate={controls}
        initial="initial"
        variants={variants.line1}
        x1="22"
        x2="2"
        y1="6"
        y2="6"
      />
      <motion.line
        animate={controls}
        initial="initial"
        variants={variants.line2}
        x1="22"
        x2="2"
        y1="18"
        y2="18"
      />
      <motion.line
        animate={controls}
        initial="initial"
        variants={variants.line3}
        x1="6"
        x2="6"
        y1="2"
        y2="22"
      />
      <motion.line
        animate={controls}
        initial="initial"
        variants={variants.line4}
        x1="18"
        x2="18"
        y1="2"
        y2="22"
      />
    </motion.svg>
  );
}

function Frame(props: FrameProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Frame,
  Frame as FrameIcon,
  type FrameProps,
  type FrameProps as FrameIconProps,
  animations,
};
