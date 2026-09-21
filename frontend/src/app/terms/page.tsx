import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument, LegalSection } from '@/components/legal-document';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that apply when you use LiftIQ.',
};

const linkClass = 'text-brand underline underline-offset-4 hover:text-brand-hover';

const sections: LegalSection[] = [
  {
    id: 'agreement',
    heading: 'Agreement',
    body: (
      <>
        <p>
          These Terms of Service govern your use of LiftIQ. By creating an account or using LiftIQ you agree to them
          and to our{' '}
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          . If you do not agree, do not use LiftIQ.
        </p>
        {LEGAL.operatorName && <p>LiftIQ is operated by {LEGAL.operatorName}.</p>}
      </>
    ),
  },
  {
    id: 'service',
    heading: 'What LiftIQ does',
    body: (
      <p>
        LiftIQ uses your device&apos;s camera to estimate your body position while you exercise. It counts repetitions,
        scores your form, shows live cues, keeps a log of your sessions and writes a coaching report after each
        workout.
      </p>
    ),
  },
  {
    id: 'safety',
    heading: 'Health and safety',
    body: (
      <>
        <p>
          LiftIQ is not medical advice and does not diagnose injuries or conditions. Talk to a doctor or qualified
          coach before you start a new exercise programme, especially if you have a health condition or an injury.
        </p>
        <p>
          The counts, scores and cues are automated estimates. Camera angle, lighting, clothing and other people in
          frame can make them wrong. You are responsible for judging whether an exercise is safe for you. Stop if you
          feel pain, dizziness or strain. You use LiftIQ at your own risk.
        </p>
      </>
    ),
  },
  {
    id: 'ai',
    heading: 'AI-written reports',
    body: (
      <p>
        Coaching reports are written by a third-party AI language model from numeric summaries of your workout. They
        can be inaccurate, generic or incomplete. Treat them as suggestions, not instructions.
      </p>
    ),
  },
  {
    id: 'account',
    heading: 'Your account',
    body: (
      <ul>
        <li>Give accurate details when you sign up and keep them up to date.</li>
        <li>Keep your password private. You are responsible for activity under your account.</li>
        <li>Tell us promptly if you think someone else has used your account.</li>
      </ul>
    ),
  },
  {
    id: 'camera',
    heading: 'Using the camera around other people',
    body: (
      <p>
        Do not point your camera at people who have not agreed to be filmed or analysed, and do not use LiftIQ
        anywhere filming is not allowed. If someone else appears in frame, you are responsible for their consent.
      </p>
    ),
  },
  {
    id: 'use',
    heading: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>use LiftIQ for anything unlawful;</li>
          <li>access, or try to access, another person&apos;s account or data;</li>
          <li>interfere with or overload the service, or try to bypass its security;</li>
          <li>copy, scrape or reverse engineer the service, except where the law allows it.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'data',
    heading: 'Your data',
    body: (
      <p>
        You keep your rights in your workout data. You give us permission to process it to run LiftIQ for you, as
        described in the Privacy Policy.
      </p>
    ),
  },
  {
    id: 'changes-to-service',
    heading: 'Availability and changes to the service',
    body: (
      <p>
        We aim to keep LiftIQ available but do not promise it will be uninterrupted or error free. We may change,
        suspend or stop features.
      </p>
    ),
  },
  {
    id: 'ending',
    heading: 'Ending your use of LiftIQ',
    body: (
      <p>
        You can stop using LiftIQ at any time. We may suspend or close an account that breaks these Terms or puts the
        service or other users at risk.
      </p>
    ),
  },
  {
    id: 'liability',
    heading: 'Warranties and liability',
    body: (
      <>
        <p>
          LiftIQ is provided as it is and as available. To the extent the law allows, we do not give warranties about
          it and we are not liable for indirect or consequential loss, or for injury that results from exercising.
        </p>
        <p>Nothing in these Terms limits liability that cannot be limited by law.</p>
      </>
    ),
  },
  {
    id: 'changes-to-terms',
    heading: 'Changes to these Terms',
    body: (
      <p>
        We may update these Terms. The current version is always on this page with its effective date. If you keep
        using LiftIQ after a change takes effect, you accept the updated Terms.
      </p>
    ),
  },
  ...(LEGAL.governingLaw
    ? [
        {
          id: 'law',
          heading: 'Governing law',
          body: <p>These Terms are governed by the laws of {LEGAL.governingLaw}.</p>,
        },
      ]
    : []),
  ...(LEGAL.contactEmail
    ? [
        {
          id: 'contact',
          heading: 'Contact',
          body: (
            <p>
              Questions about these Terms:{' '}
              <a href={`mailto:${LEGAL.contactEmail}`} className={linkClass}>
                {LEGAL.contactEmail}
              </a>
              .
            </p>
          ),
        },
      ]
    : []),
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      intro={<p>Please read these Terms before you use LiftIQ. They explain what you can expect from us and what we expect from you.</p>}
      sections={sections}
    />
  );
}
