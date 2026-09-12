async function requestAIAnalysis(context) {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new Error('AI_SERVICE_URL is not defined in the environment.');
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }
      const error = new Error(errorData.message || 'AI service error');
      error.status = response.status;
      error.details = errorData;
      throw error;
    }

    return await response.json();
  } catch (error) {
    console.warn(`AI analysis failed: ${error.message}`);
    
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      const e = new Error('AI analysis timed out');
      e.status = 504;
      e.code = 'AI_SERVICE_TIMEOUT';
      throw e;
    }
    
    if (error.status) {
      throw error;
    }
    
    const e = new Error('AI service is currently unavailable');
    e.status = 503;
    e.code = 'AI_SERVICE_UNAVAILABLE';
    throw e;
  }
}

module.exports = { requestAIAnalysis };
