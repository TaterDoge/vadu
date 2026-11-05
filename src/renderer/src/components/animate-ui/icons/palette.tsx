"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type PaletteProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    board: {},
    dab1: {
      animate: {
        opacity: [0, 1],
        transition: { delay: 0.38, duration: 0.3, ease: "easeOut" },
      },
      initial: { opacity: 1 },
    },
    dab2: {
      animate: {
        opacity: [0, 1],
        transition: { delay: 0.52, duration: 0.3, ease: "easeOut" },
      },
      initial: { opacity: 1 },
    },
    dab3: {
      animate: {
        opacity: [0, 1],
        transition: { delay: 0.1, duration: 0.3, ease: "easeOut" },
      },
      initial: { opacity: 1 },
    },
    dab4: {
      animate: {
        opacity: [0, 1],
        transition: { delay: 0.24, duration: 0.3, ease: "easeOut" },
      },
      initial: { opacity: 1 },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: PaletteProps) {
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
        d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"
        initial="initial"
        variants={variants.board}
      />
      <motion.circle
        animate={controls}
        cx="13.5"
        cy="6.5"
        fill="currentColor"
        initial="initial"
        r=".5"
        variants={variants.dab1}
      />
      <motion.circle
        animate={controls}
        cx="17.5"
        cy="10.5"
        fill="currentColor"
        initial="initial"
        r=".5"
        variants={variants.dab2}
      />
      <motion.circle
        animate={controls}
        cx="6.5"
        cy="12.5"
        fill="currentColor"
        initial="initial"
        r=".5"
        variants={variants.dab3}
      />
      <motion.circle
        animate={controls}
        cx="8.5"
        cy="7.5"
        fill="currentColor"
        initial="initial"
        r=".5"
        variants={variants.dab4}
      />
    </motion.svg>
  );
}

function Palette(props: PaletteProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Palette,
  Palette as PaletteIcon,
  type PaletteProps,
  type PaletteProps as PaletteIconProps,
  animations,
};
