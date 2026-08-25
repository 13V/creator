/**
 * The handful of facts in the legal pages that only the operator can supply.
 *
 * Kept in one file, and read by all three pages, because a contact address
 * that is right on the privacy policy and stale on the terms is worse than
 * having neither — and because the platforms reviewing an OAuth application
 * check that the address on the page actually reaches somebody.
 */

/** Where notices, deletion requests and creator objections are received. */
export const CONTACT_EMAIL = "hello@backd.fun";

/** The legal entity these terms are offered by. */
export const OPERATOR = "Backd";

/** Whose courts and law govern the terms. */
export const JURISDICTION = "New South Wales, Australia";

/**
 * Shown at the top of each page. A policy without a date cannot be reasoned
 * about — a reader cannot tell whether the version they agreed to is the one
 * in front of them. Bump this whenever the wording changes materially.
 */
export const LAST_UPDATED = "25 August 2026";
