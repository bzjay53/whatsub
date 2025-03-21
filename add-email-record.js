const https = require('https');

// Email 필드만 추가한 테스트 데이터
const testData = {
    records: [
        {
            fields: {
                Name: "User With Email",
                Notes: "This user has an email",
                Status: "Todo",
                Email: "test@example.com"  // Email 필드 추가
            }
        }
    ]
};

console.log('Adding test data with Email field...');

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
            console.log('Success! Test data with Email added successfully:');
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