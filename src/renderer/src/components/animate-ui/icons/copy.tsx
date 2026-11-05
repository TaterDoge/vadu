"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type CopyProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path: {
      animate: {
        transition: { duration: 0.3, ease: "easeInOut" },
        x: -1,
        y: -1,
      },
      initial: { transition: { duration: 0.3, ease: "easeInOut" }, x: 0, y: 0 },
    },
    rect: {
      animate: { transition: { duration: 0.3, ease: "easeInOut" }, x: 1, y: 1 },
      initial: { transition: { duration: 0.3, ease: "easeInOut" }, x: 0, y: 0 },
    },
  } satisfies Record<string, Variants>,
  "default-loop": {
    path: {
      animate: {
        transition: { duration: 0.6, ease: "easeInOut" },
        x: [0, -1, 0],
        y: [0, -1, 0],
      },
      initial: { x: 0, y: 0 },
    },
    rect: {
      animate: {
        transition: { duration: 0.6, ease: "easeInOut" },
        x: [0, 1, 0],
        y: [0, 1, 0],
      },
      initial: { x: 0, y: 0 },
    },
  } satisfies Record<string, Variants>,
  merge: {
    path: {
      animate: {
        transition: {
          duration: 0.3,
          ease: "easeInOut",
        },
        x: 3,
        y: 3,
      },
      initial: {
        x: 0,
        y: 0,
      },
    },
    rect: {
      animate: {
        transition: {
          duration: 0.3,
          ease: "easeInOut",
        },
        x: -3,
        y: -3,
      },
      initial: {
        x: 0,
        y: 0,
      },
    },
  } satisfies Record<string, Variants>,
  "merge-loop": {
    path: {
      animate: {
        transition: {
          duration: 0.6,
          ease: "easeInOut",
        },
        x: [0, 3, 0],
        y: [0, 3, 0],
      },
      initial: {
        x: 0,
        y: 0,
      },
    },
    rect: {
      animate: {
        transition: {
          duration: 0.6,
          ease: "easeInOut",
        },
        x: [0, -3, 0],
        y: [0, -3, 0],
      },
      initial: {
        x: 0,
        y: 0,
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CopyProps) {
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
        height={14}
        initial="initial"
        rx={2}
        ry={2}
        variants={variants.rect}
        width={14}
        x={8}
        y={8}
      />
      <motion.path
        animate={controls}
        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
        initial="initial"
        variants={variants.path}
      />
    </motion.svg>
  );
}

function Copy(props: CopyProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Copy,
  Copy as CopyIcon,
  type CopyProps,
  type CopyProps as CopyIconProps,
  animations,
};
