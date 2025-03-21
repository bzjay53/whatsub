const https = require('https');

// 테스트 데이터
const testData = {
    records: [
        {
            fields: {
                Name: "John Doe",
                Notes: "Premium user",
                Status: "Active",
                Email: "john.doe@example.com",
                "Created At": "2024-03-01T10:00:00.000Z",
                "Last Login": "2024-03-20T15:30:00.000Z",
                "Subscription Status": "Active",
                "Subscription Type": "Premium",
                "Start Date": "2024-03-01",
                "End Date": "2025-03-01"
            }
        },
        {
            fields: {
                Name: "Jane Smith",
                Notes: "Free tier user",
                Status: "Todo",
                Email: "jane.smith@example.com",
                "Created At": "2024-02-15T09:00:00.000Z",
                "Last Login": "2024-03-19T11:45:00.000Z",
                "Subscription Status": "Trial",
                "Subscription Type": "Free",
                "Start Date": "2024-02-15",
                "End Date": "2024-04-15"
            }
        },
        {
            fields: {
                Name: "Alex Johnson",
                Notes: "Basic tier user",
                Status: "In progress",
                Email: "alex.johnson@example.com",
                "Created At": "2023-12-10T14:20:00.000Z",
                "Last Login": "2024-03-18T08:15:00.000Z",
                "Subscription Status": "Active",
                "Subscription Type": "Basic",
                "Start Date": "2023-12-10",
                "End Date": "2024-12-10"
            }
        }
    ]
};

console.log('Adding test data with all fields...');

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
            console.log(JSON.parse(data));
        } else {
            console.log('Error adding test data:');
            console.log(data);
            
            if (res.statusCode === 422 && data.includes("Unknown field name")) {
                console.log('\nSome fields are missing. Please make sure you have created all required fields:');
                console.log('1. Email (Email type)');
                console.log('2. Created At (Date & Time type)');
                console.log('3. Last Login (Date & Time type)');
                console.log('4. Subscription Status (Single select type with options: Active, Inactive, Trial, Expired)');
                console.log('5. Subscription Type (Single select type with options: Free, Basic, Premium)');
                console.log('6. Start Date (Date type)');
                console.log('7. End Date (Date type)');
            }
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(JSON.stringify(testData));
req.end(); 