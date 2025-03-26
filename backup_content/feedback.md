# WhatSub 피드백

## 여러분의 의견을 들려주세요!

WhatSub을 더 좋게 만들기 위해 사용자 여러분의 의견이 필요합니다. 아래 양식을 통해 피드백, 버그 신고, 또는 기능 제안을 보내주세요.

## 피드백 양식

<form id="feedback-form">
  <div class="form-group">
    <label for="name">이름 (선택)</label>
    <input type="text" id="name" placeholder="이름을 입력하세요">
  </div>
  
  <div class="form-group">
    <label for="email">이메일 주소 (선택)</label>
    <input type="email" id="email" placeholder="회신을 원하시면 이메일을 입력하세요">
  </div>
  
  <div class="form-group">
    <label for="feedback-type">피드백 유형</label>
    <select id="feedback-type" required>
      <option value="" disabled selected>피드백 유형을 선택하세요</option>
      <option value="general">일반 피드백</option>
      <option value="bug">버그 신고</option>
      <option value="feature">기능 제안</option>
      <option value="other">기타</option>
    </select>
  </div>
  
  <div class="form-group">
    <label for="subject">제목</label>
    <input type="text" id="subject" placeholder="피드백의 주제를 간략히 알려주세요" required>
  </div>
  
  <div class="form-group">
    <label for="message">상세 내용</label>
    <textarea id="message" rows="5" placeholder="피드백 내용을 자세히 알려주세요" required></textarea>
  </div>
  
  <div class="form-group" id="bug-details" style="display: none;">
    <label for="steps">재현 단계 (버그 신고의 경우)</label>
    <textarea id="steps" rows="3" placeholder="버그가 발생하는 단계를 순서대로 알려주세요"></textarea>
  </div>
  
  <div class="form-group">
    <label for="browser">브라우저 정보 (선택)</label>
    <input type="text" id="browser" placeholder="예: Chrome 120.0.6099.129">
  </div>
  
  <div class="form-check">
    <input type="checkbox" id="contact-ok">
    <label for="contact-ok">이 피드백에 대해 추가 정보를 요청할 수 있습니다</label>
  </div>
  
  <button type="submit" class="btn-primary">피드백 보내기</button>
</form>

## 자주 묻는 질문 (FAQ)

피드백을 보내기 전에 [도움말 페이지](https://whatsub.netlify.app/help)에서 일반적인 질문에 대한 답변을 확인해보세요.

## 기타 문의 방법

- 이메일: [support@whatsub.netlify.app](mailto:support@whatsub.netlify.app)
- 트위터: [@WhatSubApp](https://twitter.com/WhatSubApp)

## 감사의 말씀

WhatSub은 사용자 여러분의 피드백을 통해 계속해서 발전하고 있습니다. 소중한 의견을 보내주셔서 감사합니다!

<script>
document.addEventListener('DOMContentLoaded', function() {
  const feedbackType = document.getElementById('feedback-type');
  const bugDetails = document.getElementById('bug-details');
  
  feedbackType.addEventListener('change', function() {
    if(this.value === 'bug') {
      bugDetails.style.display = 'block';
    } else {
      bugDetails.style.display = 'none';
    }
  });
});
</script>

---

마지막 업데이트: 2024년 3월 25일 