"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type EraserProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    body: {},
    group: {
      animate: {
        transition: { duration: 0.8, ease: "easeInOut" },
        x: [0, 1.6, -1.2, 0.8, 0],
      },
      initial: { x: 0 },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: EraserProps) {
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
        d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21m-7.752-9.91l8.828 8.828"
        initial="initial"
        variants={variants.body}
      />
    </motion.svg>
  );
}

function Eraser(props: EraserProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Eraser,
  Eraser as EraserIcon,
  type EraserProps,
  type EraserProps as EraserIconProps,
  animations,
};
