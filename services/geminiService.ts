import { AIReport } from "../types";

/**
 * Requests the AI SEO report.
 *
 * Throws rather than returning null. The previous version swallowed every
 * failure into a null, and the page rendered nothing for it - so a rejected
 * API key, a retired model and an exhausted quota were indistinguishable from
 * a button that simply did not work. The caller is expected to show the
 * message.
 */
export const getSEOAdvice = async (siteUrl: string, da: number): Promise<AIReport> => {
  let response: Response;

  try {
    response = await fetch('/api/seo-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: siteUrl, da })
    });
  } catch (error) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `The report could not be generated (${response.status}).`);
  }

  return response.json();
};
