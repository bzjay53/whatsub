/**
 * Whatsub 확장 프로그램 디버그 도구
 * 이 스크립트는 개발자가 확장 프로그램의 작동 상태를 진단하고 문제를 해결하는 데 도움을 줍니다.
 */

document.addEventListener('DOMContentLoaded', function() {
  // 버전 정보 표시
  displayVersionInfo();
  
  // 확장 프로그램 상태 확인
  checkExtensionStatus();
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 초기 로그 로딩
  loadLogs();
  
  // 개발자 모드 상태 확인
  checkDeveloperMode();
});

// 버전 정보 표시
function displayVersionInfo() {
  const versionElement = document.getElementById('version');
  if (versionElement) {
    try {
      const manifest = chrome.runtime.getManifest();
      versionElement.textContent = `v${manifest.version || '0.0.0'}`;
    } catch (error) {
      console.error('버전 정보 로딩 실패:', error);
      versionElement.textContent = 'v0.0.0';
    }
  }
}

// 확장 프로그램 상태 확인
function checkExtensionStatus() {
  const statusText = document.getElementById('status-text');
  if (!statusText) return;
  
  try {
    chrome.runtime.sendMessage({ action: 'checkBackgroundStatus' })
      .then(response => {
        if (response && response.isActive) {
          statusText.textContent = '정상 작동 중';
          document.getElementById('extension-status').classList.add('status-online');
          document.getElementById('extension-status').classList.remove('status-offline');
        } else {
          statusText.textContent = '응답 없음';
          document.getElementById('extension-status').classList.add('status-offline');
          document.getElementById('extension-status').classList.remove('status-online');
        }
      })
      .catch(error => {
        console.error('백그라운드 상태 확인 실패:', error);
        statusText.textContent = '연결 실패';
        document.getElementById('extension-status').classList.add('status-offline');
        document.getElementById('extension-status').classList.remove('status-online');
      });
      
    // API 서버 상태 확인
    checkApiServerStatus();
  } catch (error) {
    console.error('확장 프로그램 상태 확인 중 오류:', error);
    statusText.textContent = '오류 발생';
    document.getElementById('extension-status').classList.add('status-offline');
    document.getElementById('extension-status').classList.remove('status-online');
  }
}

// API 서버 상태 확인
function checkApiServerStatus() {
  const apiStatusText = document.getElementById('api-status-text');
  const apiStatusMessage = document.getElementById('api-status-message');
  const apiStatus = document.getElementById('api-status');
  
  if (!apiStatusText || !apiStatus) return;
  
  try {
    chrome.runtime.sendMessage({ action: 'checkApiStatus' })
      .then(response => {
        if (response && response.isOnline) {
          apiStatusText.textContent = '온라인';
          apiStatus.classList.add('status-online');
          apiStatus.classList.remove('status-offline');
          
          if (apiStatusMessage) {
            apiStatusMessage.textContent = `응답 시간: ${response.responseTime || 0}ms`;
          }
        } else {
          apiStatusText.textContent = '오프라인';
          apiStatus.classList.add('status-offline');
          apiStatus.classList.remove('status-online');
          
          if (apiStatusMessage && response.error) {
            apiStatusMessage.textContent = `오류: ${response.error}`;
          }
        }
      })
      .catch(error => {
        console.error('API 서버 상태 확인 실패:', error);
        apiStatusText.textContent = '연결 실패';
        apiStatus.classList.add('status-offline');
        apiStatus.classList.remove('status-online');
        
        if (apiStatusMessage) {
          apiStatusMessage.textContent = `오류: ${error.message || '알 수 없는 오류'}`;
        }
      });
  } catch (error) {
    console.error('API 서버 상태 확인 중 오류:', error);
    apiStatusText.textContent = '오류 발생';
    apiStatus.classList.add('status-offline');
    apiStatus.classList.remove('status-online');
  }
}

// 개발자 모드 상태 확인
function checkDeveloperMode() {
  const developerModeCheckbox = document.getElementById('developer-mode');
  if (!developerModeCheckbox) return;
  
  chrome.storage.local.get(['developerMode'], function(result) {
    developerModeCheckbox.checked = !!result.developerMode;
  });
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 상태 새로고침 버튼
  const refreshStatusBtn = document.getElementById('refresh-status');
  if (refreshStatusBtn) {
    refreshStatusBtn.addEventListener('click', function() {
      checkExtensionStatus();
    });
  }
  
  // 로그 새로고침 버튼
  const refreshLogsBtn = document.getElementById('refresh-logs');
  if (refreshLogsBtn) {
    refreshLogsBtn.addEventListener('click', function() {
      loadLogs();
    });
  }
  
  // 로그 지우기 버튼
  const clearLogsBtn = document.getElementById('clear-logs');
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', function() {
      clearLogs();
    });
  }
  
  // 컨텐츠 스크립트 확인 버튼
  const checkContentScriptBtn = document.getElementById('check-content-script');
  if (checkContentScriptBtn) {
    checkContentScriptBtn.addEventListener('click', function() {
      checkContentScript();
    });
  }
  
  // 오디오 캡처 테스트 버튼
  const testAudioCaptureBtn = document.getElementById('test-audio-capture');
  if (testAudioCaptureBtn) {
    testAudioCaptureBtn.addEventListener('click', function() {
      testAudioCapture();
    });
  }
  
  // 자막 UI 테스트 버튼
  const testSubtitleUIBtn = document.getElementById('test-subtitle-ui');
  if (testSubtitleUIBtn) {
    testSubtitleUIBtn.addEventListener('click', function() {
      testSubtitleUI();
    });
  }
  
  // Whisper API 테스트 버튼
  const testWhisperBtn = document.getElementById('test-whisper');
  if (testWhisperBtn) {
    testWhisperBtn.addEventListener('click', function() {
      testWhisperAPI();
    });
  }
  
  // 인증 상태 확인 버튼
  const checkAuthBtn = document.getElementById('check-auth');
  if (checkAuthBtn) {
    checkAuthBtn.addEventListener('click', function() {
      checkAuthStatus();
    });
  }
  
  // 설정 초기화 버튼
  const resetSettingsBtn = document.getElementById('reset-settings');
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', function() {
      resetSettings();
    });
  }
  
  // 개발자 모드 토글
  const developerModeCheckbox = document.getElementById('developer-mode');
  if (developerModeCheckbox) {
    developerModeCheckbox.addEventListener('change', function() {
      toggleDeveloperMode(this.checked);
    });
  }
}

// 로그 로딩
function loadLogs() {
  const logsContainer = document.getElementById('logs-container');
  if (!logsContainer) return;
  
  // 로딩 표시
  logsContainer.innerHTML = '<div class="log-item">로그를 불러오는 중...</div>';
  
  chrome.runtime.sendMessage({ action: 'getLogs' })
    .then(response => {
      if (response && response.logs) {
        displayLogs(response.logs);
      } else {
        logsContainer.innerHTML = '<div class="log-item">로그를 불러올 수 없습니다.</div>';
      }
    })
    .catch(error => {
      console.error('로그 로딩 실패:', error);
      logsContainer.innerHTML = `<div class="log-item log-error">로그 로딩 중 오류: ${error.message || '알 수 없는 오류'}</div>`;
    });
}

// 로그 표시
function displayLogs(logs) {
  const logsContainer = document.getElementById('logs-container');
  if (!logsContainer) return;
  
  // 모든 로그 배열을 하나로 합치기
  let allLogs = [];
  
  if (logs.error && logs.error.length > 0) {
    allLogs = allLogs.concat(logs.error.map(log => ({ ...log, level: 'error' })));
  }
  
  if (logs.warn && logs.warn.length > 0) {
    allLogs = allLogs.concat(logs.warn.map(log => ({ ...log, level: 'warn' })));
  }
  
  if (logs.info && logs.info.length > 0) {
    allLogs = allLogs.concat(logs.info.map(log => ({ ...log, level: 'info' })));
  }
  
  if (logs.debug && logs.debug.length > 0) {
    allLogs = allLogs.concat(logs.debug.map(log => ({ ...log, level: 'debug' })));
  }
  
  // 시간순으로 정렬 (최신 순)
  allLogs.sort((a, b) => b.timestamp - a.timestamp);
  
  // 로그가 없을 경우
  if (allLogs.length === 0) {
    logsContainer.innerHTML = '<div class="log-item">저장된 로그가 없습니다.</div>';
    return;
  }
  
  // 로그 표시
  logsContainer.innerHTML = '';
  
  allLogs.forEach(log => {
    const logItem = document.createElement('div');
    logItem.className = `log-item log-${log.level}`;
    
    const date = new Date(log.timestamp);
    const time = date.toLocaleTimeString();
    
    let detailsHtml = '';
    if (log.details) {
      let detailsText = '';
      try {
        if (typeof log.details === 'object') {
          detailsText = JSON.stringify(log.details, null, 2);
        } else {
          detailsText = String(log.details);
        }
      } catch (e) {
        detailsText = '(표시할 수 없는 데이터)';
      }
      
      if (detailsText && detailsText !== '{}' && detailsText !== 'undefined') {
        detailsHtml = `<pre class="log-details">${detailsText}</pre>`;
      }
    }
    
    logItem.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
      <span class="log-source">${log.source || 'unknown'}</span>
      <span class="log-message">${log.message || ''}</span>
      ${detailsHtml}
    `;
    
    logsContainer.appendChild(logItem);
  });
}

// 로그 지우기
function clearLogs() {
  const logsContainer = document.getElementById('logs-container');
  if (!logsContainer) return;
  
  // 로딩 표시
  logsContainer.innerHTML = '<div class="log-item">로그를 지우는 중...</div>';
  
  chrome.runtime.sendMessage({ action: 'clearLogs' })
    .then(response => {
      if (response && response.success) {
        logsContainer.innerHTML = '<div class="log-item">로그가 초기화되었습니다.</div>';
      } else {
        logsContainer.innerHTML = '<div class="log-item">로그 초기화를 할 수 없습니다.</div>';
      }
    })
    .catch(error => {
      console.error('로그 초기화 실패:', error);
      logsContainer.innerHTML = `<div class="log-item log-error">로그 초기화 중 오류: ${error.message || '알 수 없는 오류'}</div>`;
    });
}

// 컨텐츠 스크립트 확인
function checkContentScript() {
  // 현재 활성 탭 찾기
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || tabs.length === 0) {
      showToast('활성 탭을 찾을 수 없습니다.', 'error');
      return;
    }
    
    // 메시지 전송으로 컨텐츠 스크립트가 활성화되어 있는지 확인
    chrome.tabs.sendMessage(tabs[0].id, { action: 'isContentScriptActive' })
      .then(response => {
        if (response && response.isActive) {
          showToast('컨텐츠 스크립트가 활성화되어 있습니다.', 'success');
          console.log('컨텐츠 스크립트 응답:', response);
        } else {
          showToast('컨텐츠 스크립트가 응답했지만 비활성 상태입니다.', 'warning');
        }
      })
      .catch(error => {
        console.error('컨텐츠 스크립트 확인 실패:', error);
        showToast('컨텐츠 스크립트가 활성화되어 있지 않습니다.', 'error');
        
        // 스크립트 주입 시도
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content-script.js']
        })
          .then(() => {
            showToast('컨텐츠 스크립트를 다시 주입했습니다. 다시 확인해보세요.', 'info');
          })
          .catch(injectError => {
            console.error('컨텐츠 스크립트 주입 실패:', injectError);
            showToast('컨텐츠 스크립트 주입 실패: ' + (injectError.message || '알 수 없는 오류'), 'error');
          });
      });
  });
}

// 오디오 캡처 테스트
function testAudioCapture() {
  // 현재 활성 탭 찾기
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || tabs.length === 0) {
      showToast('활성 탭을 찾을 수 없습니다.', 'error');
      return;
    }
    
    showToast('오디오 캡처 테스트 시작...', 'info');
    
    chrome.runtime.sendMessage({ 
      action: 'testAudioCapture',
      tabId: tabs[0].id
    })
      .then(response => {
        if (response && response.success) {
          showToast('오디오 캡처 테스트 성공', 'success');
          console.log('오디오 캡처 테스트 결과:', response);
        } else {
          showToast('오디오 캡처 테스트 실패: ' + (response.error || '알 수 없는 오류'), 'error');
        }
      })
      .catch(error => {
        console.error('오디오 캡처 테스트 실패:', error);
        showToast('오디오 캡처 테스트 실패: ' + (error.message || '알 수 없는 오류'), 'error');
      });
  });
}

// 자막 UI 테스트
function testSubtitleUI() {
  // 현재 활성 탭 찾기
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || tabs.length === 0) {
      showToast('활성 탭을 찾을 수 없습니다.', 'error');
      return;
    }
    
    showToast('자막 UI 테스트 시작...', 'info');
    
    // 자막 테스트 메시지 전송
    chrome.tabs.sendMessage(tabs[0].id, { 
      action: 'testSubtitleUI',
      text: '이것은 테스트 자막입니다. This is a test subtitle.'
    })
      .then(response => {
        if (response && response.success) {
          showToast('자막 UI 테스트 성공', 'success');
        } else {
          showToast('자막 UI 테스트 실패: ' + (response.error || '알 수 없는 오류'), 'error');
          
          // 직접 백그라운드에 요청
          chrome.runtime.sendMessage({ 
            action: 'testSubtitle',
            tabId: tabs[0].id
          });
        }
      })
      .catch(error => {
        console.error('자막 UI 테스트 실패:', error);
        showToast('자막 UI 테스트 실패: ' + (error.message || '알 수 없는 오류'), 'error');
        
        // 직접 백그라운드에 요청
        chrome.runtime.sendMessage({ 
          action: 'testSubtitle',
          tabId: tabs[0].id
        });
      });
  });
}

// Whisper API 테스트
function testWhisperAPI() {
  showToast('Whisper API 테스트 시작...', 'info');
  
  chrome.runtime.sendMessage({ action: 'testWhisperAPI' })
    .then(response => {
      if (response && response.success) {
        showToast('Whisper API 테스트 성공', 'success');
        console.log('Whisper API 테스트 결과:', response);
      } else {
        showToast('Whisper API 테스트 실패: ' + (response.error || '알 수 없는 오류'), 'error');
      }
    })
    .catch(error => {
      console.error('Whisper API 테스트 실패:', error);
      showToast('Whisper API 테스트 실패: ' + (error.message || '알 수 없는 오류'), 'error');
    });
}

// 인증 상태 확인
function checkAuthStatus() {
  showToast('인증 상태 확인 중...', 'info');
  
  chrome.runtime.sendMessage({ action: 'checkAuthStatus' })
    .then(response => {
      if (response && response.isAuthenticated) {
        showToast('인증됨: ' + (response.user?.email || '알 수 없는 사용자'), 'success');
        console.log('인증 상태:', response);
      } else {
        showToast('인증되지 않음', 'warning');
      }
    })
    .catch(error => {
      console.error('인증 상태 확인 실패:', error);
      showToast('인증 상태 확인 실패: ' + (error.message || '알 수 없는 오류'), 'error');
    });
}

// 설정 초기화
function resetSettings() {
  if (!confirm('모든 설정을 초기화하시겠습니까?')) {
    return;
  }
  
  showToast('설정 초기화 중...', 'info');
  
  chrome.runtime.sendMessage({ action: 'resetSettings' })
    .then(response => {
      if (response && response.success) {
        showToast('설정이 초기화되었습니다.', 'success');
      } else {
        showToast('설정 초기화 실패: ' + (response.error || '알 수 없는 오류'), 'error');
      }
    })
    .catch(error => {
      console.error('설정 초기화 실패:', error);
      showToast('설정 초기화 실패: ' + (error.message || '알 수 없는 오류'), 'error');
    });
}

// 개발자 모드 토글
function toggleDeveloperMode(enabled) {
  chrome.runtime.sendMessage({ action: 'setDeveloperMode', developerMode: enabled })
    .then(response => {
      if (response && response.success) {
        showToast(`개발자 모드가 ${enabled ? '활성화' : '비활성화'}되었습니다.`, 'success');
      } else {
        showToast('개발자 모드 설정 실패: ' + (response.error || '알 수 없는 오류'), 'error');
      }
    })
    .catch(error => {
      console.error('개발자 모드 설정 실패:', error);
      showToast('개발자 모드 설정 실패: ' + (error.message || '알 수 없는 오류'), 'error');
    });
}

// 토스트 메시지 표시
function showToast(message, type = 'info') {
  // 기존 토스트 제거
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => {
    toast.remove();
  });
  
  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // 문서에 추가
  document.body.appendChild(toast);
  
  // 애니메이션 적용
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 자동 제거
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
} 