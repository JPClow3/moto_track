import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Payload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from =
    Deno.env.get("DEFAULT_FROM_EMAIL") ??
    "Moto Track <no-reply@moto-track.net>";
  if (!apiKey) {
    return Response.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const payload = (await request.json()) as Payload;
  if (!payload.to || !payload.subject || !payload.text) {
    return Response.json(
      { error: "to, subject and text are required." },
      { status: 400 },
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  const body = await response.json();
  return Response.json(body, { status: response.status });
});
