import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument, LegalSection } from '@/components/legal-document';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What LiftIQ collects, why, and who else handles it.',
};

const linkClass = 'text-brand underline underline-offset-4 hover:text-brand-hover';

const sections: LegalSection[] = [
  {
    id: 'scope',
    heading: 'Who this covers',
    body: (
      <>
        <p>
          This policy explains what personal data the LiftIQ web app collects, how it is used and who else handles it.
          It applies together with our{' '}
          <Link href="/terms" className={linkClass}>
            Terms of Service
          </Link>
          .
        </p>
        {LEGAL.operatorName && <p>The data controller is {LEGAL.operatorName}.</p>}
      </>
    ),
  },
  {
    id: 'collect',
    heading: 'What we collect',
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> your name and email address, and your password. The password is stored
          only as a salted hash, never in readable form. We also record the time you accepted the Terms and Privacy
          Policy.
        </li>
        <li>
          <strong>Sign-in records:</strong> your last sign-in time, and a hashed token that keeps you signed in.
        </li>
        <li>
          <strong>Workout data:</strong> the exercise, start and end times, rep counts, and for each completed rep a
          score and a short note. The live coaching cues you see during a workout are shown on screen and are not
          saved.
        </li>
        <li>
          <strong>Coaching reports:</strong> the text written about each workout.
        </li>
        <li>
          <strong>Technical logs:</strong> our hosting providers keep standard server logs, such as IP address, time
          and the page or endpoint requested.
        </li>
      </ul>
    ),
  },
  {
    id: 'camera',
    heading: 'Your camera',
    body: (
      <>
        <p>
          When you start a workout, your browser sends still frames from your camera to our server over an encrypted
          connection. The server finds your body position in each frame, draws the overlay you see and sends the
          frame back to you.
        </p>
        <p>
          Frames are processed in memory and are not saved. We keep only the numbers worked out from them, such as
          rep counts and form scores.
        </p>
      </>
    ),
  },
  {
    id: 'ai',
    heading: 'AI coaching reports',
    body: (
      <p>
        After a workout we send a numeric summary (the exercise, rep counts, duration, timings and form scores) to
        Groq, a third-party AI provider, which returns the report text. Your name, email address and video are not
        included in that request.
      </p>
    ),
  },
  {
    id: 'use',
    heading: 'How we use your data',
    body: (
      <ul>
        <li>To create and secure your account and keep you signed in.</li>
        <li>To count reps, score form and show you live feedback during a workout.</li>
        <li>To store your history and produce your coaching reports.</li>
        <li>To keep the service secure, diagnose faults and prevent abuse.</li>
      </ul>
    ),
  },
  {
    id: 'processors',
    heading: 'Who else handles your data',
    body: (
      <>
        <p>We use these providers to run LiftIQ:</p>
        <ul>
          <li>Vercel, which serves the web app;</li>
          <li>Render, which runs the server that analyses camera frames;</li>
          <li>Supabase, which hosts the database;</li>
          <li>Groq, which writes the coaching reports.</li>
        </ul>
        <p>We do not sell your personal data and we do not use it for advertising.</p>
      </>
    ),
  },
  {
    id: 'storage',
    heading: 'Cookies and browser storage',
    body: (
      <p>
        LiftIQ stores your sign-in tokens in your browser&apos;s local storage so you stay signed in. It does not use
        advertising or analytics cookies. Signing out removes the tokens from your browser.
      </p>
    ),
  },
  {
    id: 'security',
    heading: 'Security',
    body: (
      <p>
        Data travels over encrypted connections, passwords are hashed, and each workout can only be read by the
        account that created it. No system is perfectly secure, so we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    id: 'retention',
    heading: 'How long we keep data',
    body: (
      <p>
        Your account and workout history are kept until they are removed. LiftIQ does not yet offer in-app account
        deletion or data export, and we do not currently delete data on a fixed schedule.
      </p>
    ),
  },
  {
    id: 'rights',
    heading: 'Your rights',
    body: (
      <>
        <p>
          Depending on where you live, you may have legal rights over your personal data, such as access, correction
          or deletion. LiftIQ does not yet have in-app tools for these.
        </p>
        {LEGAL.contactEmail ? (
          <p>
            To make a request, email{' '}
            <a href={`mailto:${LEGAL.contactEmail}`} className={linkClass}>
              {LEGAL.contactEmail}
            </a>
            .
          </p>
        ) : null}
      </>
    ),
  },
  {
    id: 'children',
    heading: 'Children',
    body: <p>LiftIQ is not aimed at children, and we do not knowingly collect their personal data.</p>,
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    body: (
      <p>
        We may update this policy. The current version is always on this page with its effective date.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      intro={<p>LiftIQ handles video-derived and fitness data, so this policy is specific about what happens to it.</p>}
      sections={sections}
    />
  );
}
