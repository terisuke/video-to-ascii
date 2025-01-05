const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');
const Speaker = require('speaker');

class Frame {
    constructor(number, startTime, endTime, content) {
        this.number = number;
        this.startTime = startTime;
        this.endTime = endTime;
        this.content = content;
    }

    static parseTimestamp(timestamp) {
        const [hours, minutes, rest] = timestamp.split(':');
        const [seconds, milliseconds] = rest.split(',');
        return (parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)) * 1000 + parseInt(milliseconds);
    }
}

class ASCIIPlayer {
    constructor(asciiPath, videoPath) {
        this.asciiPath = asciiPath;
        this.videoPath = videoPath;
        this.frames = [];
        this.isPlaying = false;
        this.startTime = 0;
        this.speaker = null;
    }

    async loadFrames() {
        try {
            const content = await fs.readFile(this.asciiPath, 'utf8');
            const frameTexts = content.split('\n\n');
            
            for (let frameText of frameTexts) {
                if (!frameText.trim()) continue;
                
                const lines = frameText.trim().split('\n');
                const number = parseInt(lines[0]);
                const [startStr, endStr] = lines[1].split(' --> ');
                const content = lines.slice(2).join('\n');
                
                this.frames.push(new Frame(
                    number,
                    Frame.parseTimestamp(startStr),
                    Frame.parseTimestamp(endStr),
                    content
                ));
            }
            
            console.log(`Loaded ${this.frames.length} frames`);
            return true;
        } catch (error) {
            console.error('Error loading frames:', error);
            return false;
        }
    }

    clearScreen() {
        process.stdout.write('\x1b[2J');
        process.stdout.write('\x1b[0f');
    }

    startAudio() {
        this.speaker = new Speaker({
            channels: 2,
            bitDepth: 16,
            sampleRate: 44100
        });

        ffmpeg(this.videoPath)
            .toFormat('s16le')
            .audioBitrate(128)
            .audioFrequency(44100)
            .audioChannels(2)
            .on('error', (err) => {
                if (!err.message.includes('Output stream closed')) {
                    console.error('Audio Error:', err);
                }
            })
            .pipe(this.speaker);
    }

    async play() {
        if (this.isPlaying) return;

        if (this.frames.length === 0) {
            const loaded = await this.loadFrames();
            if (!loaded) return;
        }

        this.isPlaying = true;
        this.startTime = Date.now();
        
        // 音声再生開始
        this.startAudio();

        // フレーム表示ループ
        const updateInterval = setInterval(() => {
            if (!this.isPlaying) {
                clearInterval(updateInterval);
                if (this.speaker) {
                    this.speaker.end();
                }
                return;
            }

            const currentTime = Date.now() - this.startTime;
            const currentFrame = this.frames.find(frame => 
                currentTime >= frame.startTime && currentTime < frame.endTime
            );

            if (currentFrame) {
                this.clearScreen();
                process.stdout.write(currentFrame.content);
            } else if (currentTime > this.frames[this.frames.length - 1].endTime) {
                // 再生終了
                this.isPlaying = false;
                clearInterval(updateInterval);
                if (this.speaker) {
                    this.speaker.end();
                }
                console.log('\nPlayback completed');
                process.exit(0);
            }
        }, 1000 / 30); // 30fpsで更新

        // Ctrl+C でのクリーンアップ
        process.on('SIGINT', () => {
            this.isPlaying = false;
            if (this.speaker) {
                this.speaker.end();
            }
            console.log('\nPlayback stopped');
            process.exit(0);
        });
    }
}

async function main() {
    if (process.argv.length < 4) {
        console.error('Usage: node index.js <ascii-file> <video-file>');
        process.exit(1);
    }

    const asciiPath = process.argv[2];
    const videoPath = process.argv[3];

    try {
        await fs.access(asciiPath);
        await fs.access(videoPath);
    } catch (error) {
        console.error(`Error: File not found: ${error.path}`);
        process.exit(1);
    }

    const player = new ASCIIPlayer(asciiPath, videoPath);
    await player.play();
}

main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});