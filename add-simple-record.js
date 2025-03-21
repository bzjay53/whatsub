const https = require('https');

// 간단한 테스트 데이터 (Name, Notes, Status만 사용)
const testData = {
    records: [
        {
            fields: {
                Name: "Simple Test User",
                Notes: "This is a test user with only basic fields",
                Status: "Todo"  // 기존에 이미 있는 값
            }
        }
    ]
};

console.log('Adding simple test data...');

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
        
        if (res.statusCode === 200) {
            console.log('Success! Test data added successfully:');
            const parsedData = JSON.parse(data);
            console.log(JSON.stringify(parsedData, null, 2));
        } else {
            console.log('Error adding test data:');
            console.log(data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(JSON.stringify(testData));
req.end(); 