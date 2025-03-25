// WhatSub 랜딩 페이지 스크립트

document.addEventListener('DOMContentLoaded', function() {
  // 스크롤 버튼 동작
  const scrollLinks = document.querySelectorAll('a[href^="#"]');
  
  scrollLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80, // 헤더 높이를 고려한 오프셋
          behavior: 'smooth'
        });
      }
    });
  });
  
  // 모바일 기기 감지
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // 모바일 메뉴 (필요시 구현)
  
  // 이미지 로딩 최적화 (LazyLoad)
  if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });
    
    lazyImages.forEach(img => {
      imageObserver.observe(img);
    });
  }
  
  // FAQ 아코디언 (필요시 구현)
  const faqItems = document.querySelectorAll('.faq-item');
  
  faqItems.forEach(item => {
    const question = item.querySelector('h3');
    if (question) {
      question.addEventListener('click', () => {
        // 이미 확장되어 있는지 확인
        const isExpanded = item.classList.contains('expanded');
        
        // 모든 항목 축소
        faqItems.forEach(faqItem => {
          faqItem.classList.remove('expanded');
        });
        
        // 현재 항목 확장 (이미 확장되어 있지 않은 경우만)
        if (!isExpanded) {
          item.classList.add('expanded');
        }
      });
    }
  });
  
  // Chrome 웹 스토어 링크 업데이트 (필요 시)
  const chromeStoreLinks = document.querySelectorAll('a[href*="chrome.google.com/webstore"]');
  const EXTENSION_ID = 'your-extension-id-here'; // 실제 ID로 대체
  
  chromeStoreLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href.includes('[extension-id]')) {
      link.setAttribute('href', href.replace('[extension-id]', EXTENSION_ID));
    }
  });
  
  // 성능 측정 (개발용)
  if (window.performance) {
    const perfData = window.performance.timing;
    window.addEventListener('load', () => {
      setTimeout(() => {
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`페이지 로드 시간: ${loadTime}ms`);
      }, 0);
    });
  }
}); 