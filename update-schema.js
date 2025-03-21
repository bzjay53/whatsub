const https = require('https');

const schema = {
    fields: [
        {
            name: 'Email',
            type: 'email',
            description: '사용자 이메일'
        },
        {
            name: 'Created At',
            type: 'dateTime',
            description: '계정 생성일'
        },
        {
            name: 'Last Login',
            type: 'dateTime',
            description: '마지막 로그인 시간'
        },
        {
            name: 'Subscription Status',
            type: 'singleSelect',
            options: {
                choices: [
                    { name: 'Active', color: 'greenLight2' },
                    { name: 'Inactive', color: 'redLight2' },
                    { name: 'Trial', color: 'yellowLight2' },
                    { name: 'Expired', color: 'grayLight2' }
                ]
            },
            description: '구독 상태'
        },
        {
            name: 'Subscription Type',
            type: 'singleSelect',
            options: {
                choices: [
                    { name: 'Free', color: 'grayLight2' },
                    { name: 'Basic', color: 'blueLight2' },
                    { name: 'Premium', color: 'purpleLight2' }
                ]
            },
            description: '구독 유형'
        },
        {
            name: 'Start Date',
            type: 'date',
            description: '구독 시작일'
        },
        {
            name: 'End Date',
            type: 'date',
            description: '구독 종료일'
        }
    ]
};

const options = {
    hostname: 'api.airtable.com',
    path: '/v0/meta/bases/appxLqTJ7OgAm1o3y/tables/tbl8VqGjvUvDw1kEi',
    method: 'PATCH',
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

req.write(JSON.stringify(schema));
req.end(); 