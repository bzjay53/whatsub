/**
 * Whatsub 웰컴 페이지 스크립트
 */
document.addEventListener('DOMContentLoaded', function() {
  // Whatsub 팝업 열기 버튼
  const openPopupBtn = document.getElementById('open-popup');
  if (openPopupBtn) {
    openPopupBtn.addEventListener('click', function(e) {
      e.preventDefault();
      try {
        chrome.runtime.sendMessage({ action: 'openPopup' })
          .then(response => {
            if (!response || !response.success) {
              // 대체 방법: 확장 프로그램 관리 페이지로 이동
              chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
            }
          })
          .catch(error => {
            console.error('팝업 열기 실패:', error);
            // 대체 방법: 확장 프로그램 관리 페이지로 이동
            chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
          });
      } catch (error) {
        console.error('팝업 열기 시도 실패:', error);
        // 대체 방법: 확장 프로그램 관리 페이지로 이동
        chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
      }
    });
  }
  
  // 개인정보 처리방침 링크
  const privacyLink = document.getElementById('privacy-link');
  if (privacyLink) {
    privacyLink.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://whatsub.io/privacy' });
    });
  }
  
  // 이용약관 링크
  const termsLink = document.getElementById('terms-link');
  if (termsLink) {
    termsLink.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://whatsub.io/terms' });
    });
  }
  
  // 문의하기 링크
  const contactLink = document.getElementById('contact-link');
  if (contactLink) {
    contactLink.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://whatsub.io/contact' });
    });
  }
  
  console.log('웰컴 페이지 스크립트 로드 완료');
}); 