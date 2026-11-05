"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type CircleAlertProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    mark: {
      animate: {
        opacity: [1, 0.15, 1, 0.15, 1],
        transition: {
          duration: 1.1,
          ease: "easeInOut",
          times: [0, 0.2, 0.45, 0.7, 1],
        },
      },
      initial: { opacity: 1 },
    },
    outline: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CircleAlertProps) {
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
      <motion.circle
        animate={controls}
        cx="12"
        cy="12"
        initial="initial"
        r="10"
        variants={variants.outline}
      />
      <motion.line
        animate={controls}
        initial="initial"
        variants={variants.mark}
        x1="12"
        x2="12"
        y1="8"
        y2="12"
      />
      <motion.line
        animate={controls}
        initial="initial"
        variants={variants.mark}
        x1="12"
        x2="12.01"
        y1="16"
        y2="16"
      />
    </motion.svg>
  );
}

function CircleAlert(props: CircleAlertProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  CircleAlert,
  CircleAlert as CircleAlertIcon,
  type CircleAlertProps,
  type CircleAlertProps as CircleAlertIconProps,
  animations,
};
