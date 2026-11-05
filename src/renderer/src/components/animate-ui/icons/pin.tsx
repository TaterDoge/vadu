"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type PinProps = IconProps<keyof typeof animations>;

const animations = {
  bounce: {
    group: {
      animate: {
        rotate: [0, 30, -15, 0],
        scale: [1, 0.75, 1, 1],
        transformOrigin: "bottom center",
        transition: { duration: 1, ease: "easeInOut" },
        x: [0, 0, 0, 0],
        y: [0, -6, 0, 0],
      },
      initial: {
        rotate: 0,
        scale: 1,
        transformOrigin: "bottom center",
        x: 0,
        y: 0,
      },
    },
    line: {},
    path: {},
  } satisfies Record<string, Variants>,
  default: {
    group: {
      animate: {
        rotate: [0, -10, 6, -3, 0],
        transformOrigin: "bottom center",
        transition: { duration: 0.8, ease: "easeInOut" },
      },
      initial: { rotate: 0, transformOrigin: "bottom center" },
    },
    line: {},
    path: {},
  } satisfies Record<string, Variants>,
  rotate: {
    group: {
      animate: {
        perspective: 600,
        transform: "rotate3d(0, 1, 0, 360deg)",
        transition: { duration: 0.7, ease: "easeInOut" },
      },
      initial: {
        perspective: 600,
        transform: "rotate3d(0, 1, 0, 0deg)",
      },
    },
    line: {},
    path: {},
  } satisfies Record<string, Variants>,
  wiggle: {
    group: {
      animate: {
        rotate: [0, 15, -10, 0],
        transformOrigin: "bottom center",
        transition: { duration: 1, ease: "easeInOut" },
      },
      initial: {
        rotate: 0,
        transformOrigin: "bottom center",
      },
    },
    line: {},
    path: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: PinProps) {
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
      <motion.g animate={controls} initial="initial" variants={variants.group}>
        <motion.line
          animate={controls}
          initial="initial"
          variants={variants.line}
          x1={12}
          x2={12}
          y1={17.1}
          y2={22}
        />
        <motion.path
          animate={controls}
          d="M9,10.8c0,.8-.4,1.5-1.1,1.8l-1.8.9c-.7.3-1.1,1-1.1,1.8v.8c0,.6.4,1,1,1h12c.6,0,1-.4,1-1v-.8c0-.8-.4-1.5-1.1-1.8l-1.8-.9c-.7-.3-1.1-1-1.1-1.8v-3.8c0-.6.4-1,1-1,1.1,0,2-.9,2-2s-.9-2-2-2h-8c-1.1,0-2,.9-2,2s.9,2,2,2,1,.4,1,1v3.8Z"
          initial="initial"
          variants={variants.path}
        />
      </motion.g>
    </motion.svg>
  );
}

function Pin(props: PinProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Pin,
  Pin as PinIcon,
  type PinProps,
  type PinProps as PinIconProps,
  animations,
};
