"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type KeyboardProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    body: {},
    group: {},
    midKeys: {
      animate: {
        transition: { delay: 0.12, duration: 0.35, ease: "easeInOut" },
        y: [0, 0.6, 0],
      },
      initial: { y: 0 },
    },
    space: {
      animate: {
        transition: { delay: 0.24, duration: 0.35, ease: "easeInOut" },
        y: [0, 0.6, 0],
      },
      initial: { y: 0 },
    },
    topKeys: {
      animate: {
        transition: { duration: 0.35, ease: "easeInOut" },
        y: [0, 0.6, 0],
      },
      initial: { y: 0 },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: KeyboardProps) {
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
        height={16}
        initial="initial"
        rx={2}
        variants={variants.body}
        width={20}
        x={2}
        y={4}
      />
      <motion.path
        animate={controls}
        d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01"
        initial="initial"
        variants={variants.topKeys}
      />
      <motion.path
        animate={controls}
        d="M8 12h.01M12 12h.01M16 12h.01"
        initial="initial"
        variants={variants.midKeys}
      />
      <motion.path
        animate={controls}
        d="M7 16h10"
        initial="initial"
        variants={variants.space}
      />
    </motion.svg>
  );
}

function Keyboard(props: KeyboardProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Keyboard,
  Keyboard as KeyboardIcon,
  type KeyboardProps,
  type KeyboardProps as KeyboardIconProps,
  animations,
};
