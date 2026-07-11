# LiftIQ Product Requirements Document (PRD)

**Version:** 1.0
**Status:** MVP Development
**Owner:** Joel Sebastian

---

# 1. Executive Summary

LiftIQ is an AI-powered fitness coaching platform that helps users improve exercise technique using computer vision and artificial intelligence.

Unlike traditional workout trackers that only count repetitions or record workout history, LiftIQ analyzes movement quality in real time and provides personalized coaching to improve exercise form.

The objective of the MVP is to deliver a production-ready web application that users can access from any modern browser using only their webcam.

---

# 2. Vision

Build an intelligent AI fitness coach capable of delivering real-time exercise analysis, posture correction, workout tracking, and personalized coaching.

The long-term vision is to become an AI-first fitness platform rather than a workout logging application.

---

# 3. Problem Statement

Many gym users perform exercises incorrectly without realizing it.

Incorrect form leads to:

* Reduced training effectiveness
* Increased injury risk
* Lack of confidence while exercising
* No immediate feedback
* Expensive dependence on personal trainers

Existing fitness applications mainly track workouts but rarely analyze movement quality in real time.

LiftIQ solves this problem using computer vision and AI.

---

# 4. Target Users

## Primary Users

* College students
* Gym beginners
* Intermediate lifters
* Home workout users
* Fitness enthusiasts

---

## Secondary Users

* Personal trainers
* Rehabilitation professionals
* Fitness coaches
* University fitness clubs

---

# 5. Goals

The MVP must enable users to:

* Create an account
* Log in securely
* Start a workout session
* Select an exercise
* Receive live AI posture corrections
* View live repetition counting
* Receive a post-workout AI coaching report
* Track previous workout sessions
* Monitor improvement over time

---

# 6. Success Metrics

The MVP is considered successful if it achieves:

### Product

* Stable deployment
* Smooth workout experience
* Accurate repetition counting
* Reliable posture analysis
* Useful AI coaching

### Technical

* Backend deployment succeeds
* Frontend deployment succeeds
* PostgreSQL persistence works
* Authentication is secure
* Reports are generated successfully

### User Experience

* User can complete an entire workout without errors.
* Dashboard updates immediately after a workout.
* AI report appears within a few seconds after workout completion.

---

# 7. Core Features

## Authentication

Users can:

* Register
* Login
* Logout
* View profile

---

## Workout Tracking

Users can:

* Select an exercise
* Start workout
* View webcam feed
* Receive live posture feedback
* View repetition count
* End workout

---

## AI Coach

After every workout:

* Analyze workout metrics
* Generate personalized coaching
* Identify strengths
* Identify mistakes
* Suggest improvements
* Recommend focus for next session

---

## Dashboard

Users can view:

* Workout streak
* Weekly activity
* Workout history
* AI recommendations
* Progress analytics
* Performance trends

---

## Reports

Each completed workout generates a report containing:

* Exercise name
* Workout duration
* Total repetitions
* Estimated calories
* Overall score
* Form score
* AI summary
* Strengths
* Improvements
* Historical comparison

---

# 8. Functional Requirements

### FR-1

Users must be able to register.

---

### FR-2

Users must authenticate securely.

---

### FR-3

Users must be able to start and stop workout sessions.

---

### FR-4

The system must detect supported exercises.

---

### FR-5

The system must count repetitions.

---

### FR-6

The system must provide live coaching.

---

### FR-7

The system must save completed sessions.

---

### FR-8

The system must generate AI coaching reports.

---

### FR-9

Users must be able to review historical reports.

---

### FR-10

Dashboard analytics must update automatically.

---

# 9. Non-Functional Requirements

The application must be:

* Responsive
* Fast
* Secure
* Reliable
* Maintainable
* Accessible
* Deployable
* Modular
* Type-safe

---

# 10. Out of Scope (MVP)

The following are intentionally excluded:

* Payment integration
* Premium subscriptions
* Social feed
* Friend system
* Community challenges
* Wearable integration
* Nutrition planning
* Mobile applications
* Smartwatch support
* Push notifications

---

# 11. User Stories

### As a new user

I want to register so that I can save my workout history.

---

### As a returning user

I want to log in quickly so that I can continue training.

---

### As a gym user

I want real-time posture correction so that I perform exercises safely.

---

### As a fitness enthusiast

I want AI-generated coaching so that I know how to improve.

---

### As a user

I want to review previous workouts so that I can measure progress.

---

### As a recruiter evaluating the project

I should be able to explore the application and understand its capabilities within a few minutes.

---

# 12. MVP Acceptance Criteria

The MVP is complete only when:

* Users can authenticate.
* Workout sessions are persisted.
* AI posture analysis works.
* Rep counting works.
* Live coaching works.
* AI reports are generated.
* Dashboard analytics function correctly.
* Responsive UI is complete.
* Backend is deployed.
* Frontend is deployed.
* Database is deployed.
* Documentation is complete.

---

# 13. Risks

Potential risks include:

* Webcam permission issues
* Browser compatibility differences
* Poor lighting affecting pose estimation
* Groq API failures or latency
* Database connectivity failures
* Large report generation times

Mitigation strategies should be documented and implemented where practical.

---

# 14. Future Roadmap

### Phase 2

* Voice coaching
* Exercise recommendations
* Workout plans
* Personal records
* Better analytics

### Phase 3

* Mobile application
* Wearable integration
* Trainer dashboard
* Team accounts
* AI workout planner

---

# 15. Product Principles

Every feature should satisfy the following principles:

1. Simplicity over complexity.
2. AI should assist, not overwhelm.
3. Every screen should have a clear purpose.
4. Performance is a feature.
5. Existing working AI modules must be preserved.
6. Build production-quality software from the beginning.
7. Optimize for reliability before adding new features.

---

# 16. Definition of Success

A recruiter should be able to:

1. Open the application.
2. Register or use a demo account.
3. Start a workout.
4. Watch real-time exercise analysis.
5. Receive an AI-generated workout report.
6. View analytics on the dashboard.

The experience should resemble a polished SaaS product rather than a university assignment.
---

## Document Control

**Status:** Active

**Approval Required For Changes:** Yes

**Next Review:** After MVP Release

**Maintainer:** Joel Sebastian

---

_End of Document_