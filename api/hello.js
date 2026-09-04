export default function handler(req, res) {
  return new Response(JSON.stringify({ message: 'Hello from Vercel!' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}