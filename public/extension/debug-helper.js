/**
 * WhatSub 디버깅 도우미 스크립트
 * 이 스크립트는 자막 UI가 나타나지 않는 문제를 해결하기 위한 디버그 도구입니다.
 */

(function() {
    console.log('[WhatSub Debug] 디버그 헬퍼 스크립트 로드됨');
    
    // 디버그 UI 생성
    function createDebugUI() {
        try {
            // 이미 존재하는 디버그 UI 확인
            if (document.getElementById('whatsub-debug-panel')) {
                return;
            }
            
            // 디버그 패널 생성
            const debugPanel = document.createElement('div');
            debugPanel.id = 'whatsub-debug-panel';
            debugPanel.style.position = 'fixed';
            debugPanel.style.top = '10px';
            debugPanel.style.left = '10px';
            debugPanel.style.width = '320px';
            debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            debugPanel.style.color = 'white';
            debugPanel.style.padding = '15px';
            debugPanel.style.borderRadius = '10px';
            debugPanel.style.zIndex = '2147483647';
            debugPanel.style.fontFamily = 'Arial, sans-serif';
            debugPanel.style.fontSize = '14px';
            debugPanel.style.boxShadow = '0px 4px 15px rgba(0, 0, 0, 0.4)';
            debugPanel.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            
            // 제목
            const title = document.createElement('div');
            title.textContent = 'WhatSub 디버그 패널';
            title.style.fontSize = '16px';
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '10px';
            title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
            title.style.paddingBottom = '5px';
            debugPanel.appendChild(title);
            
            // 상태 정보
            const status = document.createElement('div');
            status.id = 'whatsub-debug-status';
            status.style.marginBottom = '10px';
            debugPanel.appendChild(status);
            
            // 버튼 컨테이너
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.flexDirection = 'column';
            buttonContainer.style.gap = '8px';
            debugPanel.appendChild(buttonContainer);
            
            // 테스트 버튼 생성
            const createTestButton = (text, action, explanation) => {
                const button = document.createElement('button');
                button.textContent = text;
                button.style.padding = '8px 12px';
                button.style.margin = '2px 0';
                button.style.backgroundColor = 'rgba(66, 133, 244, 0.7)';
                button.style.border = 'none';
                button.style.borderRadius = '4px';
                button.style.color = 'white';
                button.style.cursor = 'pointer';
                button.style.fontWeight = 'bold';
                
                button.onclick = action;
                
                const desc = document.createElement('div');
                desc.textContent = explanation;
                desc.style.fontSize = '12px';
                desc.style.marginBottom = '6px';
                desc.style.color = '#aaa';
                
                const buttonGroup = document.createElement('div');
                buttonGroup.appendChild(desc);
                buttonGroup.appendChild(button);
                buttonContainer.appendChild(buttonGroup);
                
                return button;
            };
            
            // 자막 UI 확인 버튼
            createTestButton('자막 UI 생성 테스트', checkSubtitleUI, '자막 UI 요소가 DOM에 제대로 추가되었는지 확인합니다.');
            
            // 강제 자막 표시 버튼
            createTestButton('강제 자막 표시', forceShowSubtitle, '자막 UI를 강제로 화면에 표시합니다.');
            
            // CSS 테스트 버튼
            createTestButton('CSS 스타일 검사', checkCSSStyles, 'CSS 스타일이 제대로 적용되었는지 확인합니다.');
            
            // DOM 정보 수집 버튼
            createTestButton('DOM 정보 수집', collectDOMInfo, '현재 페이지의 DOM 구조 정보를 수집합니다.');
            
            // 디버그 패널 닫기 버튼
            const closeButton = document.createElement('button');
            closeButton.textContent = '패널 닫기';
            closeButton.style.padding = '8px 12px';
            closeButton.style.marginTop = '15px';
            closeButton.style.backgroundColor = 'rgba(244, 67, 54, 0.7)';
            closeButton.style.border = 'none';
            closeButton.style.borderRadius = '4px';
            closeButton.style.color = 'white';
            closeButton.style.cursor = 'pointer';
            
            closeButton.onclick = () => {
                document.body.removeChild(debugPanel);
            };
            
            debugPanel.appendChild(closeButton);
            
            // DOM에 패널 추가
            document.body.appendChild(debugPanel);
            
            // 초기 상태 확인
            updateStatus();
            
            console.log('[WhatSub Debug] 디버그 패널이 페이지에 추가되었습니다.');
        } catch (error) {
            console.error('[WhatSub Debug] 디버그 UI 생성 오류:', error);
            alert('WhatSub 디버그 UI 생성 오류: ' + error.message);
        }
    }
    
    // 상태 업데이트
    function updateStatus() {
        try {
            const statusElement = document.getElementById('whatsub-debug-status');
            if (!statusElement) return;
            
            const subtitleContainer = document.querySelector('.whatsub-container');
            const subtitleText = document.querySelector('.whatsub-text');
            const controlsContainer = document.querySelector('.whatsub-controls');
            const interactionButtons = document.querySelector('.whatsub-interaction-buttons');
            
            let statusHTML = '';
            
            statusHTML += `<div>자막 컨테이너: <span style="color:${subtitleContainer ? '#4CAF50' : '#F44336'}">${subtitleContainer ? '존재함' : '없음'}</span></div>`;
            if (subtitleContainer) {
                statusHTML += `<div>- 표시 상태: ${subtitleContainer.style.display || '지정되지 않음'}</div>`;
                statusHTML += `<div>- 위치: bottom ${subtitleContainer.style.bottom || '지정되지 않음'}</div>`;
                statusHTML += `<div>- z-index: ${subtitleContainer.style.zIndex || '지정되지 않음'}</div>`;
            }
            
            statusHTML += `<div>자막 텍스트: <span style="color:${subtitleText ? '#4CAF50' : '#F44336'}">${subtitleText ? '존재함' : '없음'}</span></div>`;
            if (subtitleText) {
                statusHTML += `<div>- 텍스트: ${subtitleText.textContent || '없음'}</div>`;
            }
            
            statusHTML += `<div>컨트롤 패널: <span style="color:${controlsContainer ? '#4CAF50' : '#F44336'}">${controlsContainer ? '존재함' : '없음'}</span></div>`;
            statusHTML += `<div>상호작용 버튼: <span style="color:${interactionButtons ? '#4CAF50' : '#F44336'}">${interactionButtons ? '존재함' : '없음'}</span></div>`;
            
            statusElement.innerHTML = statusHTML;
        } catch (error) {
            console.error('[WhatSub Debug] 상태 업데이트 오류:', error);
        }
    }
    
    // 자막 UI 확인
    function checkSubtitleUI() {
        try {
            console.log('[WhatSub Debug] 자막 UI 확인 중...');
            
            // 1. DOM에 요소가 있는지 확인
            const subtitleContainer = document.querySelector('.whatsub-container');
            const subtitleText = document.querySelector('.whatsub-text');
            
            if (!subtitleContainer) {
                console.warn('[WhatSub Debug] 자막 컨테이너가 DOM에 없습니다.');
                
                // 수동으로 자막 컨테이너 생성
                const container = document.createElement('div');
                container.className = 'whatsub-container';
                container.style.position = 'fixed';
                container.style.bottom = '100px';
                container.style.left = '50%';
                container.style.transform = 'translateX(-50%)';
                container.style.zIndex = '2147483647';
                container.style.textAlign = 'center';
                container.style.padding = '12px 24px';
                container.style.borderRadius = '8px';
                container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                container.style.color = 'white';
                container.style.fontFamily = 'Arial, sans-serif';
                container.style.fontSize = '22px';
                container.style.fontWeight = '600';
                container.style.lineHeight = '1.5';
                container.style.boxShadow = '0px 4px 15px rgba(0, 0, 0, 0.4)';
                container.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                container.style.minWidth = '300px';
                container.style.minHeight = '50px';
                container.style.display = 'block';
                
                const text = document.createElement('p');
                text.className = 'whatsub-text';
                text.textContent = '디버그: 자막 테스트 메시지입니다.';
                container.appendChild(text);
                
                document.body.appendChild(container);
                
                console.log('[WhatSub Debug] 자막 컨테이너를 수동으로 생성했습니다.');
                alert('자막 컨테이너가 없어 수동으로 생성했습니다. 화면을 확인해주세요.');
            } else {
                console.log('[WhatSub Debug] 자막 컨테이너가 DOM에 있습니다.');
                
                // 표시 확인
                if (subtitleContainer.style.display === 'none') {
                    subtitleContainer.style.display = 'block';
                    console.log('[WhatSub Debug] 자막 컨테이너의 display를 block으로 변경했습니다.');
                }
                
                // 자막 텍스트 업데이트
                if (subtitleText) {
                    subtitleText.textContent = '디버그: 자막 테스트 메시지입니다. 화면에 보이나요?';
                    console.log('[WhatSub Debug] 자막 텍스트를 업데이트했습니다.');
                }
                
                alert('자막 컨테이너가 DOM에 있습니다. 화면에 보이는지 확인해주세요.');
            }
            
            // 상태 업데이트
            updateStatus();
        } catch (error) {
            console.error('[WhatSub Debug] 자막 UI 확인 중 오류:', error);
            alert('자막 UI 확인 중 오류: ' + error.message);
        }
    }
    
    // 강제 자막 표시
    function forceShowSubtitle() {
        try {
            console.log('[WhatSub Debug] 강제 자막 표시 중...');
            
            // 이미 존재하는 자막 컨테이너 찾기
            let subtitleContainer = document.querySelector('.whatsub-container');
            
            // 없으면 새로 생성
            if (!subtitleContainer) {
                subtitleContainer = document.createElement('div');
                subtitleContainer.className = 'whatsub-container';
                
                const subtitleText = document.createElement('p');
                subtitleText.className = 'whatsub-text';
                subtitleText.textContent = '강제 생성된 테스트 자막입니다.';
                subtitleContainer.appendChild(subtitleText);
                
                document.body.appendChild(subtitleContainer);
            }
            
            // 강제 스타일 적용
            subtitleContainer.style.position = 'fixed';
            subtitleContainer.style.bottom = '100px';
            subtitleContainer.style.left = '50%';
            subtitleContainer.style.transform = 'translateX(-50%)';
            subtitleContainer.style.zIndex = '2147483647';
            subtitleContainer.style.textAlign = 'center';
            subtitleContainer.style.padding = '12px 24px';
            subtitleContainer.style.borderRadius = '8px';
            subtitleContainer.style.backgroundColor = 'red';  // 눈에 띄게 빨간색으로
            subtitleContainer.style.color = 'white';
            subtitleContainer.style.fontFamily = 'Arial, sans-serif';
            subtitleContainer.style.fontSize = '22px';
            subtitleContainer.style.fontWeight = '600';
            subtitleContainer.style.lineHeight = '1.5';
            subtitleContainer.style.boxShadow = '0px 4px 15px rgba(0, 0, 0, 0.4)';
            subtitleContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            subtitleContainer.style.minWidth = '300px';
            subtitleContainer.style.minHeight = '50px';
            subtitleContainer.style.display = 'block';
            
            // 자막 텍스트 업데이트
            const subtitleText = subtitleContainer.querySelector('.whatsub-text');
            if (subtitleText) {
                subtitleText.textContent = '강제 표시된 테스트 자막입니다. 보이시나요?';
            }
            
            console.log('[WhatSub Debug] 자막을 강제로 표시했습니다.');
            alert('자막을 강제로 표시했습니다. 화면을 확인해주세요.');
            
            // 상태 업데이트
            updateStatus();
        } catch (error) {
            console.error('[WhatSub Debug] 강제 자막 표시 중 오류:', error);
            alert('강제 자막 표시 중 오류: ' + error.message);
        }
    }
    
    // CSS 스타일 검사
    function checkCSSStyles() {
        try {
            console.log('[WhatSub Debug] CSS 스타일 검사 중...');
            
            // 모든 스타일시트 확인
            const styleSheets = document.styleSheets;
            let foundContentCSS = false;
            let contentCSSRules = [];
            
            for (let i = 0; i < styleSheets.length; i++) {
                try {
                    const sheet = styleSheets[i];
                    if (sheet.href && sheet.href.includes('content.css')) {
                        foundContentCSS = true;
                        
                        // 규칙 수집
                        const rules = sheet.cssRules || sheet.rules;
                        for (let j = 0; j < rules.length; j++) {
                            if (rules[j].selectorText && (
                                rules[j].selectorText.includes('.whatsub-container') ||
                                rules[j].selectorText.includes('.whatsub-text') ||
                                rules[j].selectorText.includes('.whatsub-controls')
                            )) {
                                contentCSSRules.push({
                                    selector: rules[j].selectorText,
                                    cssText: rules[j].cssText
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[WhatSub Debug] 스타일시트 액세스 오류 (CORS):', e);
                }
            }
            
            // 결과 레포트
            let cssReport = '';
            if (foundContentCSS) {
                cssReport += `WhatSub CSS 파일이 로드되었습니다.\n`;
                cssReport += `발견된 관련 CSS 규칙: ${contentCSSRules.length}개\n\n`;
                
                contentCSSRules.forEach((rule, index) => {
                    cssReport += `${index + 1}. ${rule.selector}\n`;
                });
            } else {
                cssReport += `WhatSub CSS 파일이 로드되지 않았습니다!\n`;
                cssReport += `이것이 문제의 원인일 수 있습니다.\n`;
            }
            
            console.log('[WhatSub Debug] CSS 검사 결과:', cssReport);
            alert(`CSS 검사 결과:\n${cssReport}`);
            
            // 인라인 스타일로 필수 CSS 적용
            const inlineStyle = document.createElement('style');
            inlineStyle.textContent = `
                .whatsub-container {
                    position: fixed !important;
                    bottom: 100px !important;
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                    z-index: 2147483647 !important;
                    text-align: center !important;
                    padding: 12px 24px !important;
                    border-radius: 8px !important;
                    background-color: rgba(0, 0, 0, 0.8) !important;
                    color: white !important;
                    font-family: 'Arial', sans-serif !important;
                    font-size: 22px !important;
                    font-weight: 600 !important;
                    display: block !important;
                }
            `;
            document.head.appendChild(inlineStyle);
            
            console.log('[WhatSub Debug] 인라인 스타일을 추가했습니다.');
        } catch (error) {
            console.error('[WhatSub Debug] CSS 스타일 검사 중 오류:', error);
            alert('CSS 스타일 검사 중 오류: ' + error.message);
        }
    }
    
    // DOM 정보 수집
    function collectDOMInfo() {
        try {
            console.log('[WhatSub Debug] DOM 정보 수집 중...');
            
            const domInfo = {
                url: window.location.href,
                title: document.title,
                bodyExists: !!document.body,
                bodyChildCount: document.body ? document.body.childElementCount : 0,
                headChildCount: document.head ? document.head.childElementCount : 0,
                scriptCount: document.querySelectorAll('script').length,
                iframeCount: document.querySelectorAll('iframe').length,
                hasWhatsub: {
                    container: !!document.querySelector('.whatsub-container'),
                    text: !!document.querySelector('.whatsub-text'),
                    controls: !!document.querySelector('.whatsub-controls'),
                    interactionButtons: !!document.querySelector('.whatsub-interaction-buttons')
                }
            };
            
            console.log('[WhatSub Debug] DOM 정보:', domInfo);
            
            let domReport = '';
            domReport += `URL: ${domInfo.url}\n`;
            domReport += `페이지 제목: ${domInfo.title}\n`;
            domReport += `Body 존재: ${domInfo.bodyExists}\n`;
            domReport += `Body 자식 요소 수: ${domInfo.bodyChildCount}\n`;
            domReport += `Head 자식 요소 수: ${domInfo.headChildCount}\n`;
            domReport += `스크립트 수: ${domInfo.scriptCount}\n`;
            domReport += `iframe 수: ${domInfo.iframeCount}\n\n`;
            
            domReport += `WhatSub 요소 존재 여부:\n`;
            domReport += `- 자막 컨테이너: ${domInfo.hasWhatsub.container}\n`;
            domReport += `- 자막 텍스트: ${domInfo.hasWhatsub.text}\n`;
            domReport += `- 컨트롤 패널: ${domInfo.hasWhatsub.controls}\n`;
            domReport += `- 상호작용 버튼: ${domInfo.hasWhatsub.interactionButtons}\n`;
            
            alert(`DOM 정보:\n${domReport}`);
            
            // 콘솔에 WhatSub 관련 요소 출력
            const whatsubElements = document.querySelectorAll('[class*="whatsub"]');
            console.log('[WhatSub Debug] 발견된 WhatSub 관련 요소:', whatsubElements);
        } catch (error) {
            console.error('[WhatSub Debug] DOM 정보 수집 중 오류:', error);
            alert('DOM 정보 수집 중 오류: ' + error.message);
        }
    }
    
    // DOM이 준비된 후 실행
    function initialize() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createDebugUI);
        } else {
            createDebugUI();
        }
    }
    
    // 초기화 실행
    initialize();
    
    // 페이지에 디버그 도구 액세스를 위한 전역 객체 추가
    window.whatsubDebug = {
        createDebugUI,
        checkSubtitleUI,
        forceShowSubtitle,
        checkCSSStyles,
        collectDOMInfo,
        updateStatus
    };
})(); 