"use client";

import {
  type IconProps,
  IconWrapper,
  getVariants,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { type Variants, motion } from "motion/react";

type FilterProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    body: {},
    group: {
      animate: {
        rotate: [0, -5, 3, -1.5, 0],
        transformOrigin: "top center",
        transition: { duration: 0.7, ease: "easeInOut" },
      },
      initial: { rotate: 0 },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: FilterProps) {
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
        d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"
        initial="initial"
        variants={variants.body}
      />
    </motion.svg>
  );
}

function Filter(props: FilterProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Filter,
  Filter as FilterIcon,
  type FilterProps,
  type FilterProps as FilterIconProps,
  animations,
};
