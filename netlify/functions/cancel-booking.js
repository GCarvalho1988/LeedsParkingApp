exports.handler = async (event) => {
  const res = await fetch(process.env.FLOW_CANCEL_BOOKING, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: event.body,
  });
  const data = await res.json();
  return { statusCode: res.status, body: JSON.stringify(data) };
};
