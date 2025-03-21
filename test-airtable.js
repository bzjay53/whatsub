const https = require('https');

const options = {
    hostname: 'api.airtable.com',
    path: '/v0/appxLqTJ7OgAm1o3y/tbl8VqGjvUvDw1kEi',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer patntfoegeu8HNbLV'
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