import { StatusPage } from '@/components/status-page';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <StatusPage
      label="Error 404"
      title="Page not found"
      description="The page you asked for does not exist, or it has moved. Check the address, or go back to your dashboard."
    >
      <ButtonLink href="/">Go to dashboard</ButtonLink>
      <ButtonLink href="/history" variant="secondary">
        View history
      </ButtonLink>
    </StatusPage>
  );
}
