"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type LayersProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      animate: {
        transition: {
          duration: 0.3,
          ease: "easeInOut",
        },
        y: 5,
      },
      initial: {
        y: 0,
      },
    },
    path2: {},
    path3: {
      animate: {
        transition: {
          duration: 0.3,
          ease: "easeInOut",
        },
        y: -5,
      },
      initial: {
        y: 0,
      },
    },
  } satisfies Record<string, Variants>,
  "default-loop": {
    path1: {
      animate: {
        transition: {
          duration: 0.6,
          ease: "easeInOut",
        },
        y: [0, 5, 0],
      },
      initial: {
        y: 0,
      },
    },
    path2: {},
    path3: {
      animate: {
        transition: {
          duration: 0.6,
          ease: "easeInOut",
        },
        y: [0, -5, 0],
      },
      initial: {
        y: 0,
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: LayersProps) {
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
        d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
        initial="initial"
        variants={variants.path1}
      />
      <motion.path
        animate={controls}
        d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
        initial="initial"
        variants={variants.path2}
      />
      <motion.path
        animate={controls}
        d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
        initial="initial"
        variants={variants.path3}
      />
    </motion.svg>
  );
}

function Layers(props: LayersProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Layers,
  Layers as LayersIcon,
  type LayersProps,
  type LayersProps as LayersIconProps,
  animations,
};
