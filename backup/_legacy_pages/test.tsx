import { useState } from 'react';

export default function TestPage() {
    const [response, setResponse] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [dbStatus, setDbStatus] = useState<any>(null);
    const [dbError, setDbError] = useState<string>('');
    const [dbLoading, setDbLoading] = useState(false);

    const generateTestPassword = () => {
        return 'Test1234!'; // 테스트용 비밀번호 (대문자, 소문자, 숫자, 특수문자 포함)
    };

    const testDatabaseConnection = async () => {
        setDbLoading(true);
        setDbError('');
        setDbStatus(null);

        try {
            const res = await fetch('/api/test-db');
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || '데이터베이스 연결 테스트 실패');
            }

            setDbStatus(data);
        } catch (err: any) {
            setDbError(err.message);
        } finally {
            setDbLoading(false);
        }
    };

    const testAdminCreation = async () => {
        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: `admin${Date.now()}@whatsub.ai`,
                    name: 'Admin User',
                    password: generateTestPassword(),
                    adminSecret: process.env.ADMIN_SECRET || 'your-admin-secret-key'
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '알 수 없는 오류가 발생했습니다.');
            }

            setResponse(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const testUserRegistration = async () => {
        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: `test${Date.now()}@example.com`,
                    name: 'Test User',
                    password: generateTestPassword()
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '알 수 없는 오류가 발생했습니다.');
            }

            setResponse(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">API 테스트</h1>
                
                <div className="space-y-6">
                    {/* 데이터베이스 연결 테스트 섹션 */}
                    <div className="space-y-4">
                        <button
                            onClick={testDatabaseConnection}
                            disabled={dbLoading}
                            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                ${dbLoading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} 
                                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                        >
                            {dbLoading ? '연결 테스트 중...' : '데이터베이스 연결 테스트'}
                        </button>

                        {dbError && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">
                                            {dbError}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {dbStatus && (
                            <div className="bg-green-50 border-l-4 border-green-400 p-4">
                                <p className="text-sm text-green-700 font-medium mb-2">{dbStatus.message}</p>
                                <pre className="text-xs text-gray-600 overflow-auto">
                                    {JSON.stringify(dbStatus.result, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-200" />

                    {/* 관리자 계정 생성 테스트 섹션 */}
                    <div className="space-y-4">
                        <button
                            onClick={testAdminCreation}
                            disabled={loading}
                            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                ${loading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'} 
                                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
                        >
                            {loading ? '처리 중...' : '관리자 계정 생성 테스트'}
                        </button>

                        <div className="text-sm text-gray-500 mt-2">
                            <p>테스트 비밀번호: {generateTestPassword()}</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">
                                            {error}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {response && (
                            <div className="bg-green-50 border-l-4 border-green-400 p-4">
                                <p className="text-sm text-green-700 font-medium mb-2">성공!</p>
                                <pre className="text-xs text-gray-600 overflow-auto">
                                    {JSON.stringify(response, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-200" />

                    {/* 일반 사용자 등록 테스트 섹션 */}
                    <div className="space-y-4">
                        <button
                            onClick={testUserRegistration}
                            disabled={loading}
                            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} 
                                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                            {loading ? '처리 중...' : '사용자 등록 테스트'}
                        </button>

                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">
                                            {error}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {response && (
                            <div className="bg-green-50 border-l-4 border-green-400 p-4">
                                <p className="text-sm text-green-700 font-medium mb-2">성공!</p>
                                <pre className="text-xs text-gray-600 overflow-auto">
                                    {JSON.stringify(response, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 