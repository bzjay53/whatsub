const https = require('https');

// 이메일 필드를 가진 레코드 추가
const data = {
    records: [
        {
            fields: {
                Name: 'User With Email',
                Notes: 'This user has an email field',
                Status: 'Todo',
                Email: 'test@example.com'  // 새로운 이메일 필드
            }
        }
    ]
};

const options = {
    hostname: 'api.airtable.com',
    path: '/v0/appxLqTJ7OgAm1o3y/Table%201',
    method: 'POST',
    headers: {
        'Authorization': 'Bearer patntfoegeu8HNbLV.df9b6581103cad6f692348779e39d982b6c8ef07cb9952584e76f5a35d7717b9',
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
        console.log('Response:', data);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(JSON.stringify(data));
req.end(); 