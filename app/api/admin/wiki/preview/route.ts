import { requireApiAdmin } from "../../../../../lib/services/auth";
import {
  validateWikiInput,
  wikiLanguage,
} from "../../../../../lib/services/wiki";
import { renderWikiMarkdown } from "../../../../../lib/services/wiki-markdown";
import { wikiApiError } from "../../../../../lib/services/wiki-api";
export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  try {
    const payload = await request.json();
    const data = validateWikiInput(payload);
    const language = wikiLanguage(
      data.content,
      payload.locale === "es" ? "es" : "en",
    );
    return Response.json(
      { document: renderWikiMarkdown(language.translation.body) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return wikiApiError(error);
  }
}
