'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { StatusPage } from '@/components/status-page';
import { Button, ButtonLink } from '@/components/ui/button';

export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      label="Something went wrong"
      title="This page could not be loaded"
      description={
        error.digest
          ? `An unexpected error stopped this page from loading. Try again. Reference for support: ${error.digest}.`
          : 'An unexpected error stopped this page from loading. Try again in a moment.'
      }
    >
      <Button onClick={() => retry()}>Try again</Button>
      <ButtonLink href="/" variant="secondary">
        Go to dashboard
      </ButtonLink>
    </StatusPage>
  );
}
