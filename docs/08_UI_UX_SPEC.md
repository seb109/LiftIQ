# LiftIQ UI / UX Specification

**Version:** 1.0
**Status:** Production MVP

---

# 1. Purpose

This document defines the complete visual identity, interaction model, component system, and user experience for LiftIQ.

The application should feel like a premium AI SaaS product—not a college project and not a generic admin dashboard.

Every screen should communicate quality, clarity, and confidence.

---

# 2. Product Personality

LiftIQ should feel:

* Intelligent
* Minimal
* Professional
* Calm
* Premium
* Trustworthy
* Motivating

Avoid loud, aggressive "gym" aesthetics.

---

# 3. Design Inspiration

Primary inspiration:

* Apple Fitness
* Apple Health
* Linear
* Vercel
* Stripe Dashboard
* Notion
* Whoop
* Raycast

Never imitate bodybuilding websites.

---

# 4. Brand Identity

Product Name:

LiftIQ

Tagline:

**Train Smarter. Perfect Every Rep.**

Primary Message:

AI-powered personal fitness coaching through real-time computer vision.

---

# 5. Design Principles

Every screen must satisfy:

* One primary purpose
* Minimal cognitive load
* Strong visual hierarchy
* Consistent spacing
* Smooth interaction
* Excellent readability

Avoid visual clutter.

---

# 6. Color System

## Background

#09090B

## Surface

#111827

## Card

#1F2937

## Primary

#2563EB

## Accent

#38BDF8

## Success

#22C55E

## Warning

#F59E0B

## Error

#EF4444

## Primary Text

#F8FAFC

## Secondary Text

#94A3B8

---

# 7. Typography

Preferred Fonts

* Geist
* Inter

Never use decorative fonts.

Hierarchy

H1

48px

H2

36px

H3

28px

Body

16px

Caption

14px

---

# 8. Spacing System

Base spacing:

8px

Use multiples:

8

16

24

32

40

48

64

Avoid inconsistent spacing.

---

# 9. Border Radius

Buttons

14px

Inputs

14px

Cards

20px

Dialogs

24px

Camera Container

24px

---

# 10. Shadows

Use soft shadows only.

Avoid heavy elevation.

Glassmorphism may be used sparingly.

---

# 11. Animations

Use Framer Motion.

Animations should include:

* Page transitions
* Card entrance
* Button interaction
* Modal transitions
* Toast appearance
* Progress updates
* Dashboard loading
* Report reveal

Duration:

150–300ms

Never use distracting animations.

---

# 12. Navigation

Desktop

Left Sidebar

Top Header

Content Area

Mobile

Bottom Navigation

Floating Action Button for "Start Workout"

---

# 13. Landing Page

Sections:

1. Hero
2. Features
3. How It Works
4. Screenshots
5. Benefits
6. FAQ
7. Final CTA
8. Footer

Hero must include:

* Product name
* Tagline
* CTA
* Secondary CTA
* Product preview

---

# 14. Authentication Pages

Screens:

* Login
* Register

Design:

Centered card

Minimal distractions

Single-column layout

Support:

* Email/password
* Remember me
* Forgot password
* Password visibility toggle

---

# 15. Dashboard

Widgets:

* Welcome Card
* Current Streak
* Total Sessions
* Average Form Score
* Workout Score
* Weekly Activity Chart
* Recent Workouts
* AI Coach Card
* Quick Start Workout

Cards should use a responsive grid.

Never use tables for primary dashboard content.

---

# 16. Workout Page

Layout

Left (Desktop)

Large camera preview.

Right

Workout controls.

Display:

* Selected exercise
* Rep count
* Stage
* Form score
* Timer
* Live correction
* Connection status

Controls:

* Start
* Pause
* End Session

---

# 17. Report Page

Sections

Overview

Overall Score

Form Score

Duration

Repetitions

AI Coach Summary

Strengths

Areas for Improvement

Next Session Focus

Charts

Session Timeline

Download PDF

---

# 18. Workout History

Display as cards.

Each card contains:

* Exercise
* Date
* Reps
* Duration
* Overall Score
* View Report

Support:

* Search
* Filter
* Sort
* Pagination

---

# 19. Profile Page

Display:

* Avatar
* Name
* Email
* Join Date
* Statistics
* Preferences
* Logout

---

# 20. Charts

Use Recharts.

Required charts:

* Weekly Sessions
* Form Score Trend
* Workout Frequency
* Exercise Distribution

Charts should animate smoothly.

---

# 21. Camera Component

Camera should be the visual focus.

Display overlays:

* Pose landmarks
* Live status
* Rep counter
* Form score
* Current correction

Aspect ratio should remain stable.

---

# 22. Components

Required reusable components:

* Button
* Card
* Input
* Badge
* Avatar
* Modal
* Dialog
* Drawer
* Sidebar
* Navbar
* Tooltip
* Toast
* Skeleton
* Progress Ring
* Metric Card
* Chart Card
* Workout Card
* Report Card

No duplicate component implementations.

---

# 23. Loading States

Use skeleton loaders.

Never display blank pages.

Never block the entire UI during background loading.

---

# 24. Empty States

Every empty state should include:

* Illustration or icon
* Short explanation
* Primary CTA

Example:

"No workouts yet."

"Start your first AI workout."

---

# 25. Error States

Provide:

* Friendly message
* Retry action
* Supportive language

Avoid exposing technical details.

---

# 26. Notifications

Use toast notifications.

Placement:

Top-right (desktop)

Top-center (mobile)

Types:

* Success
* Warning
* Error
* Information

---

# 27. Responsive Design

Desktop

≥1280px

Tablet

768–1279px

Mobile

≤767px

Every page must function correctly on all supported sizes.

---

# 28. Accessibility

Support:

* Keyboard navigation
* Focus indicators
* ARIA labels
* Color contrast
* Screen readers

Accessibility is required.

---

# 29. Performance

UI interactions should feel instantaneous.

Targets:

Page transition:

<300ms

Dashboard load:

<1s

Workout UI updates:

Smooth at target processing rate

Avoid unnecessary re-renders.

---

# 30. Acceptance Criteria

The UI is complete when:

* Every page follows the design system.
* Components are reusable.
* Mobile responsiveness is complete.
* Dark mode is consistent.
* Animations are smooth.
* Empty states exist.
* Loading states exist.
* Error states exist.
* Accessibility requirements are satisfied.
* The application presents as a polished commercial SaaS product.
---

## Document Control

**Status:** Active

**Approval Required For Changes:** Yes

**Next Review:** After MVP Release

**Maintainer:** Joel Sebastian

---

_End of Document_