const https = require('https');

// 먼저 현재 테이블 구조를 가져오기 위한 함수
function getTableSchema() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      path: '/v0/meta/bases/appxLqTJ7OgAm1o3y/tables/tbl8VqGjvUvDw1kEi',
      method: 'GET',
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
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to get table schema: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// 필드를 추가하는 함수
function addFields(currentSchema) {
  return new Promise((resolve, reject) => {
    // 기존 필드를 유지하면서 새 필드 추가
    const existingFields = currentSchema.fields || [];
    
    // 추가할 새 필드
    const newFields = [
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
    ];

    // 기존 필드 이름 목록
    const existingFieldNames = existingFields.map(field => field.name);
    
    // 중복되지 않는 필드만 추가
    const fieldsToAdd = newFields.filter(field => !existingFieldNames.includes(field.name));
    
    // 모든 필드를 합침 (기존 + 새로운)
    const allFields = [...existingFields, ...fieldsToAdd];

    const updateData = {
      fields: allFields
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
        
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to add fields: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(updateData));
    req.end();
  });
}

// 실행 코드
async function main() {
  try {
    console.log('Fetching current table schema...');
    const currentSchema = await getTableSchema();
    console.log('Current schema fetched successfully');
    
    console.log('Adding new fields...');
    const updatedSchema = await addFields(currentSchema);
    console.log('Fields added successfully');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main(); 