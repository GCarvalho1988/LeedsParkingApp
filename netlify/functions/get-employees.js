exports.handler = async () => {
  const res = await fetch(process.env.FLOW_GET_EMPLOYEES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await res.json();
  return { statusCode: res.status, body: JSON.stringify(data) };
};
