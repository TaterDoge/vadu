"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type BlocksProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      animate: {
        d: "M10 22V6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-6H2",
        strokeLinejoin: "miter",
        transition: {
          d: { delay: 0.3, duration: 0 },
          duration: 0.4,
          ease: "easeInOut",
          strokeLinejoin: { delay: 0.3, duration: 0 },
        },
        x: 2,
        y: -2,
      },
      initial: {
        d: "M10 22V7c0-.6-.4-1-1-1H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5c0-.6-.4-1-1-1H2",
        strokeLinejoin: "round",
        transition: {
          duration: 0.4,
          ease: "easeInOut",
        },
        x: 0,
        y: 0,
      },
    },
    path2: {
      animate: {
        d: "M15 2 H20 A2 2 0 0 1 22 4 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z",
        transition: {
          duration: 0.4,
          ease: "easeInOut",
        },
        x: -2,
        y: 2,
      },
      initial: {
        d: "M15 2 H21 A1 1 0 0 1 22 3 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z",
        transition: {
          duration: 0.4,
          ease: "easeInOut",
        },
        x: 0,
        y: 0,
      },
    },
  } satisfies Record<string, Variants>,
  "default-loop": {
    path1: {
      animate: {
        d: [
          "M10 22V7c0-.6-.4-1-1-1H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5c0-.6-.4-1-1-1H2",
          "M10 22V6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-6H2",
          "M10 22V7c0-.6-.4-1-1-1H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5c0-.6-.4-1-1-1H2",
        ],
        strokeLinejoin: ["round", "miter", "round"],
        transition: {
          d: { delay: 0.3, duration: 0 },
          duration: 0.8,
          ease: "easeInOut",
          strokeLinejoin: { delay: 0.3, duration: 0 },
        },
        x: [0, 2, 0],
        y: [0, -2, 0],
      },
      initial: {
        d: "M10 22V7c0-.6-.4-1-1-1H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5c0-.6-.4-1-1-1H2",
        strokeLinejoin: "round",
        transition: {
          duration: 0.4,
          ease: "easeInOut",
        },
        x: 0,
        y: 0,
      },
    },
    path2: {
      animate: {
        d: [
          "M15 2 H21 A1 1 0 0 1 22 3 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z",
          "M15 2 H20 A2 2 0 0 1 22 4 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z",
          "M15 2 H21 A1 1 0 0 1 22 3 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z",
        ],
        transition: {
          duration: 0.8,
          ease: "easeInOut",
        },
        x: [0, -2, 0],
        y: [0, 2, 0],
      },
      initial: {
        d: "M15 2 H21 A1 1 0 0 1 22 3 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z",
        transition: {
          duration: 0.4,
          ease: "easeInOut",
        },
        x: 0,
        y: 0,
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: BlocksProps) {
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
        d="M10 22V7c0-.6-.4-1-1-1H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5c0-.6-.4-1-1-1H2"
        initial="initial"
        variants={variants.path1}
      />
      <motion.path
        animate={controls}
        d="M15 2 H21 A1 1 0 0 1 22 3 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z"
        initial="initial"
        variants={variants.path2}
      />
    </motion.svg>
  );
}

function Blocks(props: BlocksProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Blocks,
  Blocks as BlocksIcon,
  type BlocksProps,
  type BlocksProps as BlocksIconProps,
  animations,
};
