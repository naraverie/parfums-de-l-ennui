import { getStore, connectLambda } from "@netlify/blobs";

const KEY = "posts";

export const handler = async (event) => {
  connectLambda(event);
  const store = getStore("journal");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const ACCESS_CODE = process.env.ACCESS_CODE || "changeme";

  try {
    if (event.httpMethod === "GET") {
      const posts = (await store.get(KEY, { type: "json" })) || [];
      return { statusCode: 200, headers, body: JSON.stringify(posts) };
    }

    const body = event.body ? JSON.parse(event.body) : {};

    // Simple code check, used for both real actions and the "unlock" probe
    // from the front-end (action: "verify").
    const codeOk = body.code === ACCESS_CODE;

    if (event.httpMethod === "POST" && body.action === "verify") {
      if (!codeOk) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: "Code incorrect" }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (!codeOk) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Code incorrect" }) };
    }

    if (event.httpMethod === "POST") {
      const posts = (await store.get(KEY, { type: "json" })) || [];
      const newPost = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        title: (body.title || "").trim(),
        content: (body.content || "").trim(),
        date: body.date || new Date().toISOString(),
      };
      posts.unshift(newPost);
      await store.setJSON(KEY, posts);
      return { statusCode: 200, headers, body: JSON.stringify(newPost) };
    }

    if (event.httpMethod === "PUT") {
      const posts = (await store.get(KEY, { type: "json" })) || [];
      const idx = posts.findIndex((p) => p.id === body.id);
      if (idx === -1) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Page introuvable" }) };
      }
      posts[idx] = {
        ...posts[idx],
        title: (body.title || "").trim(),
        content: (body.content || "").trim(),
      };
      await store.setJSON(KEY, posts);
      return { statusCode: 200, headers, body: JSON.stringify(posts[idx]) };
    }

    if (event.httpMethod === "DELETE") {
      const posts = (await store.get(KEY, { type: "json" })) || [];
      const filtered = posts.filter((p) => p.id !== body.id);
      await store.setJSON(KEY, filtered);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Méthode non supportée" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
