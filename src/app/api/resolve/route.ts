import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { previewEscrow } from "@/lib/escrow";
import { parseSocialInput } from "@/lib/social/parse";
import { resolveProfile } from "@/lib/social/resolve";
import { isPlatform, PLATFORMS } from "@/lib/social/types";

export const runtime = "nodejs";

const schema = z.object({
  input: z.string().min(1).max(300),
  platform: z.enum(PLATFORMS).optional(),
});

/** Turns a pasted profile URL or handle into a creator preview plus its escrow. */
export async function POST(request: Request) {
  try {
    const { input, platform } = schema.parse(await request.json());

    const ref = parseSocialInput(input, platform && isPlatform(platform) ? platform : undefined);
    if (!ref) {
      return fail(
        "That does not look like an X, Instagram, or TikTok profile. Paste a " +
          "profile link, or a handle with its platform selected.",
      );
    }

    const profile = await resolveProfile(ref.platform, ref.handle);

    return ok({ profile, escrow: previewEscrow(profile) });
  } catch (error) {
    return handleError(error);
  }
}
