const https = require('https');

// Select 필드를 추가한 테스트 데이터
const testData = {
    records: [
        {
            fields: {
                Name: "User With Select Fields",
                Notes: "This user has select fields",
                Status: "Todo",
                Email: "select@example.com",
                "Created At": "2024-03-01",
                "Last Login": "2024-03-20",
                "Start Date": "2024-03-01",
                "End Date": "2025-03-01",
                "Subscription Status": "Active",  // Single Select 필드
                "Subscription Type": "Premium"    // Single Select 필드
            }
        }
    ]
};

console.log('Adding test data with select fields...');

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
            console.log('Success! Test data with select fields added successfully:');
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