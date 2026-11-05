"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type Volume2Props = IconProps<keyof typeof animations>;

const animations = {
  blink: (() => {
    const animation: Record<string, Variants> = {
      path3: {},
    };

    for (let i = 1; i <= 2; i += 1) {
      animation[`path${i}`] = {
        animate: {
          opacity: 0,
          scale: 0,
          transition: {
            opacity: {
              delay: 0.2 * (i - 1),
              duration: 0.2,
              ease: "easeInOut",
              repeat: 1,
              repeatDelay: 0.2,
              repeatType: "reverse",
            },
            scale: {
              delay: 0.2 * (i - 1),
              duration: 0.2,
              ease: "easeInOut",
              repeat: 1,
              repeatDelay: 0.2,
              repeatType: "reverse",
            },
          },
        },
        initial: { opacity: 1, scale: 1 },
      };
    }

    return animation;
  })() satisfies Record<string, Variants>,
  default: (() => {
    const animation: Record<string, Variants> = {
      path3: {},
    };

    for (let i = 1; i <= 2; i += 1) {
      animation[`path${i}`] = {
        animate: {
          opacity: [1, 0.25, 1],
          scale: [1, 0.85, 1],
          transition: {
            delay: 0.15 * (i - 1),
            duration: 0.5,
            ease: "easeInOut",
          },
        },
        initial: { opacity: 1, scale: 1 },
      };
    }

    return animation;
  })() satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: Volume2Props) {
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
        d="M16 9a5 5 0 0 1 0 6"
        initial="initial"
        variants={variants.path1}
      />
      <motion.path
        animate={controls}
        d="M19.364 18.364a9 9 0 0 0 0-12.728"
        initial="initial"
        variants={variants.path2}
      />
      <motion.path
        animate={controls}
        d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"
        initial="initial"
        variants={variants.path3}
      />
    </motion.svg>
  );
}

function Volume2(props: Volume2Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Volume2,
  Volume2 as Volume2Icon,
  type Volume2Props,
  type Volume2Props as Volume2IconProps,
  animations,
};
