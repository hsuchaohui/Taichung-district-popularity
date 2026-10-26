// Smoke test: fetch one representative place from the Places API (New) using GOOGLE_PLACES_API_KEY.
// Run with: npm run places:test
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_PLACES_API_KEY is not set');
  process.exit(1);
}
const placeId = process.argv[2] ?? 'ChIJRw_ShSEWaTQRJOy8z1Z6woI';
const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
  headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount' },
});
console.log(response.status, await response.text());
process.exit(response.ok ? 0 : 1);
