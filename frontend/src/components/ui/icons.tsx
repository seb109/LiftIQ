import React from 'react';

/**
 * LiftIQ's own icon set. Drawn on a 24px grid, 1.75px round stroke, currentColor.
 * Icons appear only where they carry meaning: the brand mark, the six exercises,
 * score-state glyphs, and camera states. Everything else is text.
 */

export type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Brand mark: a rack upright and floor with the joint-angle arc the engine measures. */
export function LiftMark(props: IconProps) {
  return (
    <Icon strokeWidth="2.25" {...props}>
      <path d="M6 3v16h15" />
      <path d="M6 11.5a7.5 7.5 0 0 1 7.5 7.5" />
    </Icon>
  );
}

/* ── Score-state glyphs: shape carries the meaning, colour only reinforces it ── */

export function PassGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function CautionGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.5l8.5 15h-17z" />
      <path d="M12 10.5v4" />
      <path d="M12 17.25h.01" />
    </Icon>
  );
}

export function FailGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 6.5l11 11" />
      <path d="M17.5 6.5l-11 11" />
    </Icon>
  );
}

/** Camera unavailable: body with a slash through it. */
export function CameraOff(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5a1.5 1.5 0 0 1 1.5-1.5h2l1.5-2h7l1.5 2h2a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <circle cx="12" cy="13" r="3.25" />
      <path d="M3 3l18 18" />
    </Icon>
  );
}

/* ── Exercise pictograms: side-on figures showing each lift's defining position ── */

export function SquatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12.5" cy="4.5" r="1.75" />
      <path d="M12 7l-2.5 5.5" />
      <path d="M9.5 12.5l5.5 1.5-1.5 5.5" />
      <path d="M12 8.5l5 1" />
      <path d="M4.5 20.5h15" />
    </Icon>
  );
}

export function PushupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="19" cy="9" r="1.75" />
      <path d="M17 11.5L5 16" />
      <path d="M16 12.5v5.5" />
      <path d="M5 16l-1.5 2.5" />
      <path d="M3 19.5h18" />
    </Icon>
  );
}

export function BicepCurlIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="4.5" r="1.75" />
      <path d="M10 7v7.5" />
      <path d="M10 14.5l-2 6" />
      <path d="M10 14.5l2 6" />
      <path d="M10 8.5l3.5 3 .5-5.5" />
      <path d="M12.5 5.25l3 1.5" />
    </Icon>
  );
}

export function ShoulderPressIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="7" r="1.75" />
      <path d="M12 9.5v6" />
      <path d="M12 15.5l-2 5" />
      <path d="M12 15.5l2 5" />
      <path d="M12 10.5L8.5 7v-4" />
      <path d="M12 10.5L15.5 7v-4" />
      <path d="M5.5 3h13" />
    </Icon>
  );
}

export function LungeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="4.5" r="1.75" />
      <path d="M11 6.5V12" />
      <path d="M11 12l5.5 1v6.5" />
      <path d="M11 12l-4 3.5-2.5 4" />
      <path d="M3 20.5h17" />
    </Icon>
  );
}

export function DeadliftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="18" cy="6" r="1.75" />
      <path d="M16.5 8L8.5 11.5" />
      <path d="M8.5 11.5L10 16v4" />
      <path d="M15.5 9.5V14" />
      <circle cx="15.5" cy="17" r="3" />
      <path d="M4 20.5h16" />
    </Icon>
  );
}

export const EXERCISE_ICONS = {
  squat: SquatIcon,
  pushup: PushupIcon,
  bicep_curl: BicepCurlIcon,
  shoulder_press: ShoulderPressIcon,
  lunge: LungeIcon,
  deadlift: DeadliftIcon,
} as const;
