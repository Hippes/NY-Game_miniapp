// api/proxy.js - Vercel Serverless Function для прокси к API
export const config = {
    api: {
        bodyParser: true,
    },
};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const API_SERVER = 'http://31.130.131.180:8001';
    
    // Извлекаем путь: /api/proxy/api/save_score → /api/save_score
    const path = req.url.replace('/api/proxy', '');
    const targetUrl = `${API_SERVER}${path}`;
    
    try {
        const options = {
            method: req.method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (req.method === 'POST' && req.body) {
            options.body = JSON.stringify(req.body);
        }
        
        const response = await fetch(targetUrl, options);
        const data = await response.json();
        
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ 
            error: 'Proxy error', 
            message: error.message 
        });
    }
}
