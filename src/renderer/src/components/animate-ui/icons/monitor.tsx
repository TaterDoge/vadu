"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type MonitorProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {},
    screen: {
      animate: {
        opacity: [1, 0.5, 1, 0.75, 1],
        transition: { duration: 0.55, ease: "easeInOut" },
      },
      initial: { opacity: 1 },
    },
    stand: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: MonitorProps) {
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
        height={14}
        initial="initial"
        rx={2}
        variants={variants.screen}
        width={20}
        x={2}
        y={3}
      />
      <motion.path
        animate={controls}
        d="M8 21h8m-4-4v4"
        initial="initial"
        variants={variants.stand}
      />
    </motion.svg>
  );
}

function Monitor(props: MonitorProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Monitor,
  Monitor as MonitorIcon,
  type MonitorProps,
  type MonitorProps as MonitorIconProps,
  animations,
};
