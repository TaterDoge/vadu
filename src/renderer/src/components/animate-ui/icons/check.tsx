"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type CheckProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        scale: [1, 1.1, 1],
        transition: {
          duration: 0.6,
          ease: "easeInOut",
        },
      },
      initial: {
        opacity: 1,
        pathLength: 1,
        scale: 1,
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CheckProps) {
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
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <motion.path
        animate={controls}
        d="m4 12 5 5L20 6"
        initial="initial"
        variants={variants.path}
      />
    </motion.svg>
  );
}

function Check(props: CheckProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Check,
  Check as CheckIcon,
  type CheckProps,
  type CheckProps as CheckIconProps,
  animations,
};
