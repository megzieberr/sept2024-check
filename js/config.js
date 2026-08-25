// Supabase connection. The anon key is a public, read-limited key — it is
// meant to sit in front-end code. Every table here has RLS on with no
// policies, so this key can only call the exam_* functions in migration.sql.
window.SB_URL = "https://pjpwhalcifywjrwtjknd.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcHdoYWxjaWZ5d2pyd3Rqa25kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODg2NzksImV4cCI6MjA5Nzk2NDY3OX0.YIKTlPHSLsgIhVN5TLDQ77aEDA-1kNwm0hHotGWwgy0";

// Call a Postgres function through PostgREST.
window.rpc = async function (fn, args) {
  const res = await fetch(window.SB_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: window.SB_KEY,
      Authorization: "Bearer " + window.SB_KEY
    },
    body: JSON.stringify(args || {})
  });
  const text = await res.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch (e) { body = text; } }
  if (!res.ok) {
    const msg = (body && body.message) ? body.message : ("HTTP " + res.status);
    throw new Error(msg);
  }
  return body;
};
