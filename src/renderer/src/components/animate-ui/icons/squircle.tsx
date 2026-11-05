"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type SquircleProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    body: {},
    group: {
      animate: {
        scale: [1, 0.94, 1.06, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
      initial: { scale: 1 },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: SquircleProps) {
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
        d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9s-9-1.8-9-9s1.8-9 9-9"
        initial="initial"
        variants={variants.body}
      />
    </motion.svg>
  );
}

function Squircle(props: SquircleProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Squircle,
  Squircle as SquircleIcon,
  type SquircleProps,
  type SquircleProps as SquircleIconProps,
  animations,
};
