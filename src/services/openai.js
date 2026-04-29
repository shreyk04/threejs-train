// OpenAI chat-completions helper for the Station AI.
// Uses function-calling so the model can trigger simulation actions.
//
// Security note: the API key is read from VITE_OPENAI_API_KEY at build time and
// will be embedded in the client bundle. Only use a key you are willing to
// expose, or proxy this through a backend before shipping.

const SYSTEM_PROMPT = `You are the Central Station AI — the voice-and-control interface for a Three.js train simulation called "Last Train Out".

ABOUT THE PROJECT (use only when asked):
- Developed by Shreya Kad, a front-end developer.
- The simulation is called "Last Train Out", set at "Central Station".
- The station has 5 active platforms; Platform 3 is the main northbound line, currently serving Manchester Piccadilly.
- The simulation features real-time 3D rendering, dynamic weather, AI-controlled passengers, and full atmospheric lighting.

YOUR PERSONALITY:
- A calm, slightly theatrical station-control AI. Think public-address announcer with a futuristic edge.
- Replies are 1–2 short sentences. Never long-winded.
- Don't mention the tools you used. Narrate the change as the station AI would announce it.

WHEN TO ACT:
- If the user describes a scene, mood, weather, time, train, camera, or demo — call the appropriate tool(s) AND write a short spoken narration.
- You may call multiple tools at once (e.g. for "stormy midnight": apply_atmosphere with night + rain + fog + lightning).
- For factual questions (who built it, how it works, what's possible), answer in text only — no tools.
- If the request is ambiguous or off-topic, stay in character and steer the user back: ask what they'd like to change, or list a couple of suggestions.

TOOL HINTS — typical numeric ranges (0–100):
- time_of_day: 0=midnight, 22=dawn, 50=midday, 62=golden hour/sunset, 88=full daylight, 5=deep night
- rain: 0=none, 28=drizzle, 60=heavy, 88=storm, 100=torrential
- fog: 0=clear, 35=light, 55=advisory, 90=dense
- wind: 0=still, 30=normal, 78=gale, 95=extreme
`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "apply_atmosphere",
      description:
        "Adjust weather, lighting, and time of day. Pass any subset of fields — only the ones you provide will change. All numeric values are 0–100.",
      parameters: {
        type: "object",
        properties: {
          time_of_day: { type: "number", minimum: 0, maximum: 100 },
          rain:        { type: "number", minimum: 0, maximum: 100 },
          fog:         { type: "number", minimum: 0, maximum: 100 },
          wind:        { type: "number", minimum: 0, maximum: 100 },
          lightning_on: {
            type: "boolean",
            description: "Enable lightning flashes (use during storms / spooky scenes).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dispatch_train",
      description: "Trigger a train arrival or departure on Platform 3.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "sound_horn",
      description: "Sound the train horn on Platform 3.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "switch_camera",
      description: "Change the active camera view.",
      parameters: {
        type: "object",
        properties: {
          view: {
            type: "string",
            enum: ["platform", "side", "front", "aerial"],
            description:
              "platform = default surveillance cam; side = side angle; front = driver's cab; aerial = bird's-eye overhead.",
          },
        },
        required: ["view"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "play_cinematic",
      description: "Start the ~90-second automated cinematic demo tour of the station.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_snow",
      description: "Toggle the snow effect across the station.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

export function hasOpenAIKey() {
  return Boolean(import.meta.env.VITE_OPENAI_API_KEY);
}

export async function chatWithOpenAI({ history, signal }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("VITE_OPENAI_API_KEY is not set");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 220,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error("OpenAI returned no message");

  const toolCalls = (msg.tool_calls || []).map((tc) => {
    let args = {};
    try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
    return { name: tc.function.name, args };
  });

  return { content: (msg.content || "").trim(), toolCalls };
}
