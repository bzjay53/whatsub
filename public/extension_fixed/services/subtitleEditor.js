// 자막 편집 서비스
const subtitleEditor = {
    isInitialized: false,

    // 자막 형식
    SUBTITLE_FORMATS: {
        SRT: 'srt',
        VTT: 'vtt',
        SMI: 'smi'
    },

    // 초기화
    async initialize() {
        if (this.isInitialized) return true;

        try {
            // 필요한 초기화 작업 수행
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('자막 편집기 초기화 오류:', error);
            return false;
        }
    },

    // 자막 파일 로드
    async loadSubtitleFile(file) {
        try {
            const content = await this.readFile(file);
            const format = this.detectFormat(file.name);
            const subtitles = this.parseSubtitles(content, format);
            
            return {
                success: true,
                subtitles,
                format
            };
        } catch (error) {
            console.error('자막 파일 로드 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // 자막 포맷 감지
    detectFormat(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return this.SUBTITLE_FORMATS[ext.toUpperCase()] || null;
    },

    // 파일 읽기
    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    },

    // 자막 파싱
    parseSubtitles(content, format) {
        switch (format) {
            case this.SUBTITLE_FORMATS.SRT:
                return this.parseSRT(content);
            case this.SUBTITLE_FORMATS.VTT:
                return this.parseVTT(content);
            case this.SUBTITLE_FORMATS.SMI:
                return this.parseSMI(content);
            default:
                throw new Error('지원하지 않는 자막 형식입니다.');
        }
    },

    // SRT 파싱
    parseSRT(content) {
        const subtitles = [];
        const blocks = content.trim().split('\n\n');

        blocks.forEach(block => {
            const lines = block.split('\n');
            if (lines.length >= 3) {
                const index = parseInt(lines[0]);
                const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
                if (timeMatch) {
                    subtitles.push({
                        index,
                        startTime: this.parseTimestamp(timeMatch[1]),
                        endTime: this.parseTimestamp(timeMatch[2]),
                        text: lines.slice(2).join('\n')
                    });
                }
            }
        });

        return subtitles;
    },

    // VTT 파싱
    parseVTT(content) {
        const subtitles = [];
        const blocks = content.trim().split('\n\n');
        let index = 1;

        blocks.forEach(block => {
            if (block.startsWith('WEBVTT')) return;

            const lines = block.split('\n');
            const timeMatch = lines[0].match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);
            if (timeMatch) {
                subtitles.push({
                    index: index++,
                    startTime: this.parseTimestamp(timeMatch[1]),
                    endTime: this.parseTimestamp(timeMatch[2]),
                    text: lines.slice(1).join('\n')
                });
            }
        });

        return subtitles;
    },

    // SMI 파싱
    parseSMI(content) {
        const subtitles = [];
        const syncMatch = content.match(/<SYNC Start=(\d+)>(.*?)(?=<SYNC|$)/g);
        let index = 1;

        if (syncMatch) {
            syncMatch.forEach(sync => {
                const startMatch = sync.match(/<SYNC Start=(\d+)>/);
                const textMatch = sync.match(/<P Class=\w+>(.*?)<\/P>/);
                if (startMatch && textMatch) {
                    const startTime = parseInt(startMatch[1]);
                    subtitles.push({
                        index: index++,
                        startTime,
                        endTime: null, // SMI는 종료 시간이 없음
                        text: this.cleanSMIText(textMatch[1])
                    });
                }
            });
        }

        return subtitles;
    },

    // SMI 텍스트 정리
    cleanSMIText(text) {
        return text
            .replace(/<br>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .trim();
    },

    // 타임스탬프 파싱
    parseTimestamp(timestamp) {
        const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
        if (match) {
            const [_, hours, minutes, seconds, milliseconds] = match;
            return (
                parseInt(hours) * 3600000 +
                parseInt(minutes) * 60000 +
                parseInt(seconds) * 1000 +
                parseInt(milliseconds)
            );
        }
        return 0;
    },

    // 자막 수정
    async editSubtitle(subtitleId, index, changes) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'editSubtitle',
                subtitleId,
                index,
                changes
            });

            if (response.success) {
                // 변경 이력 저장
                await this.saveEditHistory(subtitleId, index, changes);
                return true;
            }
            return false;
        } catch (error) {
            console.error('자막 수정 오류:', error);
            return false;
        }
    },

    // 자막 저장
    async saveSubtitles(subtitles, format) {
        try {
            const content = this.generateSubtitleFile(subtitles, format);
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `subtitles.${format}`;
            a.click();
            
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error('자막 저장 오류:', error);
            return false;
        }
    },

    // 자막 파일 생성
    generateSubtitleFile(subtitles, format) {
        switch (format) {
            case this.SUBTITLE_FORMATS.SRT:
                return this.generateSRT(subtitles);
            case this.SUBTITLE_FORMATS.VTT:
                return this.generateVTT(subtitles);
            case this.SUBTITLE_FORMATS.SMI:
                return this.generateSMI(subtitles);
            default:
                throw new Error('지원하지 않는 자막 형식입니다.');
        }
    },

    // SRT 생성
    generateSRT(subtitles) {
        return subtitles.map(sub => {
            const start = this.formatTimestamp(sub.startTime, 'srt');
            const end = this.formatTimestamp(sub.endTime, 'srt');
            return `${sub.index}\n${start} --> ${end}\n${sub.text}\n`;
        }).join('\n');
    },

    // VTT 생성
    generateVTT(subtitles) {
        return 'WEBVTT\n\n' + subtitles.map(sub => {
            const start = this.formatTimestamp(sub.startTime, 'vtt');
            const end = this.formatTimestamp(sub.endTime, 'vtt');
            return `${start} --> ${end}\n${sub.text}\n`;
        }).join('\n');
    },

    // SMI 생성
    generateSMI(subtitles) {
        const header = `<SAMI>\n<HEAD>\n<TITLE>Generated Subtitle</TITLE>\n<STYLE TYPE="text/css">\n<!--\nP { margin-left:8pt; margin-right:8pt; margin-bottom:2pt; margin-top:2pt; text-align:center; font-size:20pt; font-family:arial; font-weight:bold; color:white; }\n.KRCC { Name:한국어; lang:ko-KR; SAMIType:CC; }\n-->\n</STYLE>\n</HEAD>\n<BODY>\n`;
        
        const content = subtitles.map(sub => {
            return `<SYNC Start=${sub.startTime}>\n<P Class=KRCC>${sub.text.replace(/\n/g, '<br>')}</P>\n`;
        }).join('');

        return header + content + '</BODY>\n</SAMI>';
    },

    // 타임스탬프 포맷
    formatTimestamp(ms, format) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const milliseconds = ms % 1000;

        const pad = (n, width) => String(n).padStart(width, '0');

        if (format === 'srt') {
            return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
        } else if (format === 'vtt') {
            return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`;
        }
    },

    // 편집 이력 저장
    async saveEditHistory(subtitleId, index, changes) {
        try {
            await chrome.runtime.sendMessage({
                action: 'saveEditHistory',
                subtitleId,
                index,
                changes,
                timestamp: Date.now()
            });
            return true;
        } catch (error) {
            console.error('편집 이력 저장 오류:', error);
            return false;
        }
    }
};

// 서비스 등록
if (typeof window.services === 'undefined') {
    window.services = {};
}
window.services.subtitleEditor = subtitleEditor; 