"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type GripVerticalProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    bottom: {
      animate: {
        transition: { duration: 0.5, ease: "easeInOut" },
        y: [0, -1, 0],
      },
      initial: { y: 0 },
    },
    group: {},
    mid: {},
    top: {
      animate: {
        transition: { duration: 0.5, ease: "easeInOut" },
        y: [0, 1, 0],
      },
      initial: { y: 0 },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: GripVerticalProps) {
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
      <motion.circle
        animate={controls}
        cx={9}
        cy={5}
        initial="initial"
        r={1}
        variants={variants.top}
      />
      <motion.circle
        animate={controls}
        cx={15}
        cy={5}
        initial="initial"
        r={1}
        variants={variants.top}
      />
      <motion.circle
        animate={controls}
        cx={9}
        cy={12}
        initial="initial"
        r={1}
        variants={variants.mid}
      />
      <motion.circle
        animate={controls}
        cx={15}
        cy={12}
        initial="initial"
        r={1}
        variants={variants.mid}
      />
      <motion.circle
        animate={controls}
        cx={9}
        cy={19}
        initial="initial"
        r={1}
        variants={variants.bottom}
      />
      <motion.circle
        animate={controls}
        cx={15}
        cy={19}
        initial="initial"
        r={1}
        variants={variants.bottom}
      />
    </motion.svg>
  );
}

function GripVertical(props: GripVerticalProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  GripVertical,
  GripVertical as GripVerticalIcon,
  type GripVerticalProps,
  type GripVerticalProps as GripVerticalIconProps,
  animations,
};
