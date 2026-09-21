/**
 * Facts the Terms of Service and Privacy Policy need that only the operator can supply.
 *
 * Leave a value as null and the sentence that uses it is left out of the page rather than
 * shown with a placeholder. Set `reviewedByCounsel` to true once a lawyer has reviewed both
 * documents; until then each page says plainly that it has not been reviewed.
 */
export const LEGAL = {
  /** Shown as the effective date on both documents. Update when the wording changes. */
  effectiveDate: '21 September 2026',

  /** Legal name of the person or company that operates LiftIQ. */
  operatorName: null as string | null,

  /** Where users send privacy requests and questions about these documents. */
  contactEmail: null as string | null,

  /** Governing law and venue, for example "England and Wales". */
  governingLaw: null as string | null,

  /** Set to true after legal review to remove the review notice from both pages. */
  reviewedByCounsel: false,
};
