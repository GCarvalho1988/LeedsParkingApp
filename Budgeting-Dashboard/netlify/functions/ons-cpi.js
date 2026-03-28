// netlify/functions/ons-cpi.js
const ONS_API_URL = 'https://api.ons.gov.uk/v1/datasets/cpih01/timeseries/l522/data'

export const handler = async () => {
  try {
    const res = await fetch(ONS_API_URL)
    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `ONS upstream returned ${res.status}` }),
      }
    }
    const data = await res.json()
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
