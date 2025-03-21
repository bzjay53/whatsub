const https = require('https');

const apiKey = 'patntfoegeu8HNbLV';
const encodedKey = Buffer.from(apiKey).toString('base64');

const options = {
    hostname: 'api.airtable.com',
    path: '/v0/appxLqTJ7OgAm1o3y/tbl8VqGjvUvDw1kEi',
    method: 'GET',
    headers: {
        'Authorization': `Basic ${encodedKey}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', res.headers);
        console.log('Body:', data);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end(); 