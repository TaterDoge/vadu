"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type ServerProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    bay1: {},
    bay2: {},
    dot1: {
      animate: {
        opacity: [1, 0.25, 1],
        transition: { duration: 0.45, ease: "easeInOut" },
      },
      initial: { opacity: 1 },
    },
    dot2: {
      animate: {
        opacity: [1, 0.25, 1],
        transition: { delay: 0.15, duration: 0.45, ease: "easeInOut" },
      },
      initial: { opacity: 1 },
    },
    group: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ServerProps) {
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
        height={8}
        initial="initial"
        rx={2}
        ry={2}
        variants={variants.bay1}
        width={20}
        x={2}
        y={2}
      />
      <motion.rect
        animate={controls}
        height={8}
        initial="initial"
        rx={2}
        ry={2}
        variants={variants.bay2}
        width={20}
        x={2}
        y={14}
      />
      <motion.path
        animate={controls}
        d="M6 6h.01"
        initial="initial"
        variants={variants.dot1}
      />
      <motion.path
        animate={controls}
        d="M6 18h.01"
        initial="initial"
        variants={variants.dot2}
      />
    </motion.svg>
  );
}

function Server(props: ServerProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Server,
  Server as ServerIcon,
  type ServerProps,
  type ServerProps as ServerIconProps,
  animations,
};
