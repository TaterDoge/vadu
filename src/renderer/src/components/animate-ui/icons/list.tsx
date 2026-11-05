"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type ListProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        scale: [1.1, 1],
        transition: {
          duration: 0.4,
          ease: "easeInOut",
        },
      },
      initial: {
        opacity: 1,
        pathLength: 1,
        scale: 1,
      },
    },
    path2: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        scale: [1.1, 1],
        transition: {
          delay: 0.2,
          duration: 0.4,
          ease: "easeInOut",
        },
      },
      initial: {
        opacity: 1,
        pathLength: 1,
        scale: 1,
      },
    },
    path3: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        scale: [1.1, 1],
        transition: {
          delay: 0.4,
          duration: 0.4,
          ease: "easeInOut",
        },
      },
      initial: {
        opacity: 1,
        pathLength: 1,
        scale: 1,
      },
    },
    path4: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        scale: [1.1, 1],
        transition: {
          delay: 0.6,
          duration: 0.4,
          ease: "easeInOut",
        },
      },
      initial: {
        opacity: 1,
        pathLength: 1,
        scale: 1,
      },
    },
    path5: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        scale: [1.1, 1],
        transition: {
          delay: 0.8,
          duration: 0.4,
          ease: "easeInOut",
        },
      },
      initial: {
        opacity: 1,
        pathLength: 1,
        scale: 1,
      },
    },
    path6: {
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        scale: [1.1, 1],
        transition: {
          delay: 1,
          duration: 0.4,
          ease: "easeInOut",
        },
      },
      initial: {
        opacity: 1,
        pathLength: 1,
        scale: 1,
      },
    },
    rect: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ListProps) {
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
        d="M3 5h.01"
        initial="initial"
        variants={variants.path1}
      />
      <motion.path
        animate={controls}
        d="M8 5h13"
        initial="initial"
        variants={variants.path2}
      />
      <motion.path
        animate={controls}
        d="M3 12h.01"
        initial="initial"
        variants={variants.path3}
      />
      <motion.path
        animate={controls}
        d="M8 12h13"
        initial="initial"
        variants={variants.path4}
      />
      <motion.path
        animate={controls}
        d="M3 19h.01"
        initial="initial"
        variants={variants.path5}
      />
      <motion.path
        animate={controls}
        d="M8 19h13"
        initial="initial"
        variants={variants.path6}
      />
    </motion.svg>
  );
}

function List(props: ListProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  List,
  List as ListIcon,
  type ListProps,
  type ListProps as ListIconProps,
  animations,
};
