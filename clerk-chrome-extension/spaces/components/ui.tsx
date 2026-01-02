import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"

import { cn } from "../utils"

type ButtonVariant = "primary" | "secondary" | "ghost" | "surface"
type ButtonSize = "sm" | "md" | "lg"

export const Button = ({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) => {
  const base =
    "plasmo-inline-flex plasmo-items-center plasmo-justify-center plasmo-font-medium plasmo-rounded-lg plasmo-transition-all plasmo-duration-150 plasmo-gap-2 focus:plasmo-ring-2 focus:plasmo-ring-offset-2 focus:plasmo-ring-offset-[#09090b]"

  const variants: Record<ButtonVariant, string> = {
    primary:
      "plasmo-bg-white plasmo-text-[#09090b] hover:plasmo-bg-[#e4e4e7] focus:plasmo-ring-white plasmo-shadow-[0_15px_30px_rgba(255,255,255,0.08)]",
    secondary:
      "plasmo-border plasmo-border-[#27272a] plasmo-text-[#e4e4e7] hover:plasmo-border-[#3f3f46] hover:plasmo-text-white focus:plasmo-ring-[#27272a]",
    ghost:
      "plasmo-text-[#a1a1aa] hover:plasmo-text-white hover:plasmo-bg-[#111111] focus:plasmo-ring-[#27272a]",
    surface:
      "plasmo-bg-[#141414] plasmo-border plasmo-border-[#1f1f1f] plasmo-text-white hover:plasmo-border-[#2a2a2a] focus:plasmo-ring-[#2a2a2a]"
  }

  const sizes: Record<ButtonSize, string> = {
    sm: "plasmo-text-xs plasmo-px-3 plasmo-py-2",
    md: "plasmo-text-sm plasmo-px-4 plasmo-py-2.5",
    lg: "plasmo-text-base plasmo-px-5 plasmo-py-3"
  }

  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
}

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "spaces-card plasmo-w-full plasmo-rounded-xl plasmo-border plasmo-border-[var(--spaces-border)] plasmo-bg-[var(--spaces-surface)]",
      className
    )}
    {...props}
  />
)

export const Surface = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "spaces-surface plasmo-w-full plasmo-rounded-xl plasmo-border plasmo-border-[var(--spaces-border)] plasmo-bg-[#111111]",
      className
    )}
    {...props}
  />
)

export const SectionHeader = ({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) => (
  <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-4 plasmo-w-full">
    <div className="plasmo-space-y-2">
      <h2 className="plasmo-text-[1.8rem] plasmo-leading-tight plasmo-font-semibold plasmo-text-white">{title}</h2>
      {subtitle ? <p className="plasmo-text-sm plasmo-text-[#a1a1aa] plasmo-max-w-3xl">{subtitle}</p> : null}
    </div>
    {actions}
  </div>
)

export const StatPill = ({ children }: { children: ReactNode }) => (
  <div className="plasmo-inline-flex plasmo-items-center plasmo-gap-2 plasmo-rounded-full plasmo-border plasmo-border-[#27272a] plasmo-bg-[#111111] plasmo-px-3 plasmo-py-1.5 plasmo-text-xs plasmo-text-[#a1a1aa]">
    {children}
  </div>
)
