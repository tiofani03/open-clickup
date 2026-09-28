import React from "react";
import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router";

export interface LinkProps extends Omit<RouterLinkProps, "to"> {
  href: string;
  children?: React.ReactNode;
}

export default function Link({ href, children, ...props }: LinkProps) {
  return (
    <RouterLink to={href} {...props}>
      {children}
    </RouterLink>
  );
}
