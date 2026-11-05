"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type MoonProps = IconProps<keyof typeof animations>;

const animations = {
  balancing: {
    path: {
      animate: {
        rotate: [0, -30, 25, -15, 10, -5, 0],
        transition: {
          duration: 1.2,
          ease: "easeInOut",
        },
      },
      initial: {
        rotate: 0,
        transition: {
          duration: 0.5,
          ease: "easeInOut",
        },
      },
    },
  } satisfies Record<string, Variants>,
  default: {
    path: {
      animate: {
        rotate: [0, -15, 8, -3, 0],
        transition: { duration: 0.9, ease: "easeInOut" },
      },
      initial: { rotate: 0, transition: { duration: 0.5, ease: "easeInOut" } },
    },
  } satisfies Record<string, Variants>,
  spin: {
    path: {
      animate: {
        rotate: [0, -30, 400, 360],
        transition: {
          duration: 1.2,
          ease: ["easeInOut", "easeInOut", "easeInOut"],
          times: [0, 0.25, 0.75, 1],
        },
      },
      initial: {
        rotate: 0,
        transition: {
          duration: 0.5,
          ease: "easeInOut",
        },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: MoonProps) {
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
        d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
        initial="initial"
        variants={variants.path}
      />
    </motion.svg>
  );
}

function Moon(props: MoonProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Moon,
  Moon as MoonIcon,
  type MoonProps,
  type MoonProps as MoonIconProps,
  animations,
};
