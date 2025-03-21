import requests
import json

# API 키와 베이스 정보
api_key = "patntfoegeu8HNbLV.df9b6581103cad6f692348779e39d982b6c8ef07cb9952584e76f5a35d7717b9"
base_id = "appxLqTJ7OgAm1o3y"
table_id = "tbl8VqGjvUvDw1kEi"

# 헤더 설정
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# Schema 업데이트 URL
url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables/{table_id}"

# 추가할 필드 정의
new_fields = [
    {
        "name": "Email",
        "type": "email",
        "description": "사용자 이메일"
    },
    {
        "name": "Created At",
        "type": "dateTime",
        "description": "계정 생성일"
    },
    {
        "name": "Last Login",
        "type": "dateTime",
        "description": "마지막 로그인 시간"
    },
    {
        "name": "Subscription Status",
        "type": "singleSelect",
        "options": {
            "choices": [
                {"name": "Active", "color": "greenLight2"},
                {"name": "Inactive", "color": "redLight2"},
                {"name": "Trial", "color": "yellowLight2"},
                {"name": "Expired", "color": "grayLight2"}
            ]
        },
        "description": "구독 상태"
    },
    {
        "name": "Subscription Type",
        "type": "singleSelect",
        "options": {
            "choices": [
                {"name": "Free", "color": "grayLight2"},
                {"name": "Basic", "color": "blueLight2"},
                {"name": "Premium", "color": "purpleLight2"}
            ]
        },
        "description": "구독 유형"
    },
    {
        "name": "Start Date",
        "type": "date",
        "description": "구독 시작일"
    },
    {
        "name": "End Date",
        "type": "date",
        "description": "구독 종료일"
    }
]

# 현재 테이블 스키마 가져오기
try:
    response = requests.get(url, headers=headers)
    response.raise_for_status()  # HTTP 오류가 발생하면 예외 발생
    
    current_schema = response.json()
    print("현재 스키마 정보:")
    print(json.dumps(current_schema, indent=2))
    
    # 기존 필드 정보 추출
    existing_fields = current_schema.get("fields", [])
    existing_field_names = [field["name"] for field in existing_fields]
    
    # 중복되지 않는 필드만 추가
    fields_to_add = [field for field in new_fields if field["name"] not in existing_field_names]
    
    # 기존 필드와 새 필드 병합
    all_fields = existing_fields + fields_to_add
    
    # 필드 업데이트 요청
    update_data = {
        "fields": all_fields
    }
    
    update_response = requests.patch(url, headers=headers, json=update_data)
    update_response.raise_for_status()
    
    print("\n필드 추가 성공:")
    print(json.dumps(update_response.json(), indent=2))
    
except requests.exceptions.RequestException as e:
    print(f"오류 발생: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"응답 코드: {e.response.status_code}")
        print(f"응답 내용: {e.response.text}") 