import { NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!;
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const PLAYER_URL = process.env.PLAYER_URL!;

const DISCORD_API = "https://discord.com/api/v10";

/* ---------- Types ---------- */

interface DiscordInteractionData {
  name: string;
  options?: DiscordInteractionOption[];
}

interface DiscordInteraction {
  type: number;
  id: string;
  token: string;
  data?: DiscordInteractionData;
}

interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  poster_path?: string;
}
interface DiscordInteractionOption {
  name: string;
  value: string;
  focused?: boolean;
}
/* ---------- Discord signature verification ---------- */

function verifySignature(
  signature: string | null,
  timestamp: string | null,
  body: string,
) {
  return !!(
    signature &&
    timestamp &&
    nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, "hex"),
      Buffer.from(DISCORD_PUBLIC_KEY, "hex"),
    )
  );
}
/* ---------- Embed builder ---------- */

function buildEmbed(item: TmdbSearchResult, watchUrl: string) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rating =
    typeof item.vote_average === "number"
      ? item.vote_average.toFixed(1)
      : "N/A";

  const rawOverview = item.overview?.trim() || "No overview available.";

  const overview =
    rawOverview.length > 400 ? `${rawOverview.slice(0, 397)}...` : rawOverview;

  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : undefined;

  return {
    title,
    description: overview,
    url: watchUrl,
    color: 0x5865f2,
    fields: [
      { name: "Release Year", value: year, inline: true },
      { name: "Rating", value: `${rating} / 10`, inline: true },
    ],
    ...(poster ? { thumbnail: { url: poster } } : {}),
  };
}

/* ---------- Discord follow-up (edits the deferred response) ---------- */

async function sendFollowUp(
  interactionToken: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = `${DISCORD_API}/webhooks/${DISCORD_APPLICATION_ID}/${interactionToken}/messages/@original`;

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Discord follow-up failed (${res.status}):`, text);
    }
  } catch (err) {
    console.error("Discord follow-up request threw:", err);
  }
}

/* ---------- Command handler ---------- */

async function handleCommand(interaction: DiscordInteraction): Promise<void> {
  const token = interaction.token;
  const type = interaction.data?.name;
  const query = interaction.data?.options
    ?.find((option) => option.name === "query")
    ?.value?.trim();

  if (type !== "movie" && type !== "tv") {
    await sendFollowUp(token, {
      content: "Invalid command.",
    });
    return;
  }
  if (!query) {
    await sendFollowUp(token, {
      content: `Please provide a ${type === "movie" ? "movie" : "TV show"} title.`,
    });
    return;
  }

  try {
    const item = await getTMDBDetails(type, query);

    if (!item) {
      await sendFollowUp(token, {
        content: `${type === "movie" ? "Movie" : "TV show"} not found.`,
      });
      return;
    }

    const watchUrl = `${PLAYER_URL}/player/${type}/${item.id}`;
    const embed = buildEmbed(item, watchUrl);

    await sendFollowUp(token, {
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Watch",
              url: watchUrl,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error(err);

    await sendFollowUp(token, {
      content: "Tip: Wait for suggestions to load, then select one.",
    });
  }
}

async function handleAutocomplete(interaction: DiscordInteraction) {
  console.log("AUTOCOMPLETE HIT", interaction.data?.name);
  const commandName = interaction.data?.name;

  if (commandName !== "movie" && commandName !== "tv") {
    return NextResponse.json({
      type: 8,
      data: {
        choices: [],
      },
    });
  }

  const query = interaction.data?.options
    ?.find((option) => option.focused)
    ?.value?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({
      type: 8,
      data: {
        choices: [],
      },
    });
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/${commandName}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`,
    );

    const data = await res.json();

    const choices = (data.results ?? [])
      .slice(0, 25)
      .map((item: TmdbSearchResult) => {
        const title = item.title || item.name || "Unknown";

        const year = (item.release_date || item.first_air_date || "").slice(
          0,
          4,
        );

        return {
          name: `${title}${year ? ` (${year})` : ""}`.slice(0, 100),
          value: String(item.id),
        };
      });

    return NextResponse.json({
      type: 8,
      data: {
        choices,
      },
    });
  } catch (error) {
    console.error("Autocomplete error:", error);

    return NextResponse.json({
      type: 8,
      data: {
        choices: [],
      },
    });
  }
}
async function getTMDBDetails(type: "movie" | "tv", id: string) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`,
  );

  if (!res.ok) throw new Error("Failed to get details");

  return await res.json();
}
/* ---------- Route handler ---------- */

export async function POST(req: NextRequest) {
  if (
    !DISCORD_PUBLIC_KEY ||
    !DISCORD_APPLICATION_ID ||
    !TMDB_API_KEY ||
    !PLAYER_URL
  ) {
    console.error("Missing required Discord environment variables.");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!verifySignature(signature, timestamp, rawBody)) {
    return NextResponse.json(
      { error: "Invalid request signature" },
      { status: 401 },
    );
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Discord PING (type 1) — must be answered with type 1
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Autocomplete interaction (type 4)
  if (interaction.type === 4) {
    return handleAutocomplete(interaction);
  }

  // Slash command (type 2 = APPLICATION_COMMAND)
  if (interaction.type === 2) {
    const commandName = interaction.data?.name;

    if (commandName === "movie" || commandName === "tv") {
      handleCommand(interaction).catch(console.error);

      return NextResponse.json({ type: 5 });
    }

    return NextResponse.json({
      type: 4,
      data: { content: "Unknown command." },
    });
  }

  return NextResponse.json(
    { error: "Unhandled interaction type" },
    { status: 400 },
  );
}
