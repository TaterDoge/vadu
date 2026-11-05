"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type XProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    line1: {
      animate: {
        rotate: 90,
        transition: { duration: 0.4, ease: "easeInOut" },
      },
      initial: {
        rotate: 0,
        transition: { duration: 0.4, ease: "easeInOut" },
      },
    },
    line2: {
      animate: {
        rotate: 90,
        transition: { delay: 0.1, duration: 0.4, ease: "easeInOut" },
      },
      initial: {
        rotate: 0,
        transition: { delay: 0.1, duration: 0.4, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
  plus: {
    line1: {
      animate: {
        rotate: 45,
        transition: { delay: 0.1, duration: 0.3, ease: "easeInOut" },
        x1: 7.1,
        x2: 16.9,
        y1: 16.9,
        y2: 7.1,
      },
      initial: {
        rotate: 0,
        transition: { delay: 0.1, duration: 0.3, ease: "easeInOut" },
        x1: 6,
        x2: 18,
        y1: 18,
        y2: 6,
      },
    },
    line2: {
      animate: {
        rotate: 45,
        transition: { duration: 0.3, ease: "easeInOut" },
        x1: 7.1,
        x2: 16.9,
        y1: 7.1,
        y2: 16.9,
      },
      initial: {
        rotate: 0,
        transition: { duration: 0.3, ease: "easeInOut" },
        x1: 6,
        x2: 18,
        y1: 6,
        y2: 18,
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: XProps) {
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
        x1={6}
        x2={18}
        y1={18}
        y2={6}
      />
      <motion.line
        animate={controls}
        initial="initial"
        variants={variants.line2}
        x1={6}
        x2={18}
        y1={6}
        y2={18}
      />
    </motion.svg>
  );
}

function X(props: XProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { X, X as XIcon, type XProps, type XProps as XIconProps, animations };
