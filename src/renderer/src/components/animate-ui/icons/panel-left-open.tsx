"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type PanelLeftOpenProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    arrow: {
      animate: {
        transition: { damping: 18, stiffness: 200, type: "spring" },
        x: 2,
      },
      initial: { x: 0 },
    },
    line: {
      animate: {
        transition: { damping: 18, stiffness: 200, type: "spring" },
        x1: 11,
        x2: 11,
        y1: 3,
        y2: 21,
      },
      initial: { x1: 9, x2: 9, y1: 3, y2: 21 },
    },
    rect: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: PanelLeftOpenProps) {
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
      <motion.rect
        animate={controls}
        height={18}
        initial="initial"
        rx={2}
        ry={2}
        variants={variants.rect}
        width={18}
        x={3}
        y={3}
      />
      <motion.line
        animate={controls}
        initial="initial"
        variants={variants.line}
        x1={9}
        x2={9}
        y1={3}
        y2={21}
      />
      <motion.path
        animate={controls}
        d="m14 9 3 3-3 3"
        initial="initial"
        variants={variants.arrow}
      />
    </motion.svg>
  );
}

function PanelLeftOpen(props: PanelLeftOpenProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  PanelLeftOpen,
  PanelLeftOpen as PanelLeftOpenIcon,
  type PanelLeftOpenProps,
  type PanelLeftOpenProps as PanelLeftOpenIconProps,
  animations,
};
