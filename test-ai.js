async function testAI() {
  const api = 'http://localhost:3001/api/v1';
  
  console.log('1. Login...');
  const loginRes = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrPhone: 'admin@homeland.local', password: 'Homeland@123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('2. Test AI Chat...');
  const chat1 = await fetch(`${api}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello AI' }],
      options: { agent: 'OperationsAgent' }
    })
  });
  console.log('Chat1 status:', chat1.status);
  console.log('Chat1 response:', await chat1.json());

  console.log('3. Test Tool Permission Denial (SalesAgent finance.read)...');
  const chat2 = await fetch(`${api}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Give me the finance summary' }],
      options: { agent: 'SalesAgent' }
    })
  });
  console.log('Chat2 status:', chat2.status);
  console.log('Chat2 response:', await chat2.json());

  console.log('4. Get Usage...');
  const usage = await fetch(`${api}/ai/usage`, { headers });
  console.log('Usage status:', usage.status);
  console.log('Usage response:', await usage.json());
}

testAI().catch(console.error);
