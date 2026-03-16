import React from 'react';

export default function TestEnvPage() {
    const hasDbUrl = !!process.env.DATABASE_URL;
    const dbUrlLength = process.env.DATABASE_URL?.length || 0;

    return (
        <div style={{ padding: '2rem', color: '#fff', background: '#000', minHeight: '100vh' }}>
            <h1>Environment Test</h1>
            <p>Has DATABASE_URL: {hasDbUrl ? '✅ Yes' : '❌ No'}</p>
            <p>Length: {dbUrlLength}</p>
            <p>System Time: {new Date().toISOString()}</p>
        </div>
    );
}
