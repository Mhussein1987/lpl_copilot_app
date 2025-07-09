export default function Debug() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Debug Page</h1>
      <p>If you can see this page, the app is working correctly.</p>
      <p>Current time: {new Date().toISOString()}</p>
      <p>Environment: {process.env.NODE_ENV}</p>
      <a href="/api/test">Test API Endpoint</a>
    </div>
  );
} 