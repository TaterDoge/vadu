"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type PinOffProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      animate: {
        transition: { duration: 0.6, ease: "easeInOut" },
        x: [0, "-7%", "7%", "-7%", "7%", 0],
      },
      initial: {
        x: 0,
      },
    },
    path1: {},
    path2: {},
    path3: {},
    path4: {},
  } satisfies Record<string, Variants>,
  off: {
    path1: {},
    path2: {},
    path3: {
      animate: {
        opacity: 1,
        pathLength: 1,
        transition: { duration: 0.6, ease: "easeInOut" },
      },
      initial: {
        opacity: 0,
        pathLength: 0,
      },
    },
    path4: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: PinOffProps) {
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
        d="M12 17v5"
        initial="initial"
        variants={variants.path1}
      />
      <motion.path
        animate={controls}
        d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"
        initial="initial"
        variants={variants.path2}
      />
      <motion.path
        animate={controls}
        d="m2 2 20 20"
        initial="initial"
        variants={variants.path3}
      />
      <motion.path
        animate={controls}
        d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"
        initial="initial"
        variants={variants.path4}
      />
    </motion.svg>
  );
}

function PinOff(props: PinOffProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  PinOff,
  PinOff as PinOffIcon,
  type PinOffProps,
  type PinOffProps as PinOffIconProps,
  animations,
};
