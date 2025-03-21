const https = require('https');

// 개별 API 호출로 각 필드에 데이터 추가하기
const testData = {
    records: [
        {
            fields: {
                Name: "User with All Fields",
                Notes: "This is a complete user record",
                Status: "Todo",
                Email: "user@example.com",
                "Created At": "2024-03-20T12:00:00.000Z",
                "Last Login": "2024-03-20T14:00:00.000Z",
                "Subscription Status": "Active",
                "Subscription Type": "Premium",
                "Start Date": "2024-03-01",
                "End Date": "2025-03-01"
            }
        }
    ]
};

console.log('Attempting to create a record with all new fields...');

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
        
        if (res.statusCode === 422) {
            console.log('\nError creating fields. This is expected, as fields need to be created through the web interface.');
            console.log('Please follow these steps:');
            console.log('1. Go to https://airtable.com/appxLqTJ7OgAm1o3y/tbl8VqGjvUvDw1kEi/viwCxlbPHKVgu2fXi');
            console.log('2. Click on "+ Add field" to add each of these fields:');
            console.log('   - Email (Email type)');
            console.log('   - Created At (Date & Time type)');
            console.log('   - Last Login (Date & Time type)');
            console.log('   - Subscription Status (Single select type with options: Active, Inactive, Trial, Expired)');
            console.log('   - Subscription Type (Single select type with options: Free, Basic, Premium)');
            console.log('   - Start Date (Date type)');
            console.log('   - End Date (Date type)');
            console.log('3. After adding fields, run the add-test-data.js script to add a test record');
        } else if (res.statusCode === 200) {
            console.log('\nSuccess! All fields were added successfully.');
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(JSON.stringify(testData));
req.end(); 