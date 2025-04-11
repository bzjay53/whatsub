import { signUp } from '../lib/airtable-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const errorMessage = document.getElementById('errorMessage');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // 비밀번호 확인
        if (password !== confirmPassword) {
            errorMessage.textContent = '비밀번호가 일치하지 않습니다.';
            return;
        }

        // 비밀번호 유효성 검사 (최소 8자, 영문/숫자/특수문자 포함)
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            errorMessage.textContent = '비밀번호는 8자 이상이며, 영문, 숫자, 특수문자를 포함해야 합니다.';
            return;
        }

        try {
            const result = await signUp(name, email, password);
            if (result.success) {
                console.log('회원가입 성공:', result.user.email);
                window.location.href = 'popup.html';
            } else {
                errorMessage.textContent = result.error;
            }
        } catch (error) {
            console.error('회원가입 오류:', error);
            errorMessage.textContent = '회원가입 중 오류가 발생했습니다.';
        }
    });

    // 로그인 링크 클릭 시 로그인 페이지로 이동
    document.getElementById('loginLink').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'login.html';
    });
}); 