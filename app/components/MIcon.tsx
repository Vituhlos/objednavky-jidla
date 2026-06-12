"use client";

import { memo } from "react";
import { Icon } from "@gravity-ui/uikit";
import { resolveGravityIcon } from "@/components/gravity/iconRegistry";

function MIcon({
  name,
  size = 24,
  fill = false,
  className,
  style,
  "aria-hidden": ariaHidden = true,
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
}) {
  const data = resolveGravityIcon(name, fill);
  if (!data) return null;

  return (
    <Icon
      aria-hidden={ariaHidden}
      className={className}
      data={data}
      size={size}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
    />
  );
}

export default memo(MIcon);
