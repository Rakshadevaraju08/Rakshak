async function requestDispatchRecommendation(context) {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return null;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/dispatch/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? await response.json() : null;
  } catch (error) {
    console.warn(`AI planning unavailable; using operational fallback: ${error.message}`);
    return null;
  }
}
module.exports = { requestDispatchRecommendation };
