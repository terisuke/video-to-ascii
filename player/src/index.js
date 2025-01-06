// 必要なモジュールをインポート
const fs = require('fs').promises;  // ファイル操作用のモジュール
const ffmpeg = require('fluent-ffmpeg');  // 音声処理用のモジュール
const Speaker = require('speaker');  // 音声出力用のモジュール

// フレームを表すクラス
// 各フレームは番号、開始時間、終了時間、表示内容を持つ
class Frame {
    constructor(number, startTime, endTime, content) {
        this.number = number;  // フレーム番号
        this.startTime = startTime;  // フレーム開始時間（ミリ秒）
        this.endTime = endTime;  // フレーム終了時間（ミリ秒）
        this.content = content;  // フレームの表示内容（ASCIIアート）
    }

    // タイムスタンプ文字列（00:00:00,000形式）をミリ秒に変換するメソッド
    static parseTimestamp(timestamp) {
        const [hours, minutes, rest] = timestamp.split(':');
        const [seconds, milliseconds] = rest.split(',');
        return (parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)) * 1000 + parseInt(milliseconds);
    }
}

// ASCIIアートプレイヤーのメインクラス
class ASCIIPlayer {
    constructor(asciiPath, videoPath) {
        this.asciiPath = asciiPath;  // ASCIIアートファイルのパス
        this.videoPath = videoPath;  // 元動画ファイルのパス（音声用）
        this.frames = [];  // フレームを格納する配列
        this.isPlaying = false;  // 再生中かどうかのフラグ
        this.startTime = 0;  // 再生開始時刻
        this.speaker = null;  // 音声出力用のスピーカーオブジェクト
    }

    // ASCIIアートファイルを読み込んでフレームに分解するメソッド
    async loadFrames() {
        try {
            // ファイルを読み込む
            const content = await fs.readFile(this.asciiPath, 'utf8');
            // 空行で区切ってフレームごとに分割
            const frameTexts = content.split('\n\n');
            
            // 各フレームをパースしてFrameオブジェクトを作成
            for (let frameText of frameTexts) {
                if (!frameText.trim()) continue;
                
                const lines = frameText.trim().split('\n');
                const number = parseInt(lines[0]);  // フレーム番号
                const [startStr, endStr] = lines[1].split(' --> ');  // タイムスタンプ
                const content = lines.slice(2).join('\n');  // フレーム内容
                
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

    // 画面をクリアするメソッド
    clearScreen() {
        process.stdout.write('\x1b[2J');  // 画面全体をクリア
        process.stdout.write('\x1b[0f');  // カーソルを先頭に移動
    }

    // 音声再生を開始するメソッド
    startAudio() {
        // スピーカーの設定
        this.speaker = new Speaker({
            channels: 2,  // ステレオ
            bitDepth: 16,  // 16ビット
            sampleRate: 44100  // サンプリングレート44.1kHz
        });

        // ffmpegで動画から音声を抽出して再生
        ffmpeg(this.videoPath)
            .toFormat('s16le')  // 16ビットリニアPCMフォーマット
            .audioBitrate(128)  // ビットレート128kbps
            .audioFrequency(44100)  // サンプリングレート44.1kHz
            .audioChannels(2)  // ステレオ
            .on('error', (err) => {
                if (!err.message.includes('Output stream closed')) {
                    console.error('Audio Error:', err);
                }
            })
            .pipe(this.speaker);  // スピーカーに出力
    }

    // 再生を開始するメソッド
    async play() {
        if (this.isPlaying) return;

        // フレームが読み込まれていなければ読み込む
        if (this.frames.length === 0) {
            const loaded = await this.loadFrames();
            if (!loaded) return;
        }

        this.isPlaying = true;
        
        // 2秒70ミリ秒の遅延を追加
        await new Promise(resolve => setTimeout(resolve, 2070));

        this.startTime = Date.now();  // 再生開始時刻を記録

        // 音声再生開始
        this.startAudio();
        
        // フレーム表示ループ（30fpsで更新）
        const updateInterval = setInterval(() => {
            if (!this.isPlaying) {
                clearInterval(updateInterval);
                if (this.speaker) {
                    this.speaker.end();
                }
                return;
            }

            // 現在の再生時間を計算（フレーム表示を2秒70ミリ秒遅らせる）
            const currentTime = Date.now() - this.startTime - 750;
            // 現在表示すべきフレームを探す
            const currentFrame = this.frames.find(frame => 
                currentTime >= frame.startTime && currentTime < frame.endTime
            );

            if (currentFrame) {
                // フレームを表示
                this.clearScreen();
                process.stdout.write(currentFrame.content);
            } else if (currentTime > this.frames[this.frames.length - 1].endTime) {
                // 最後のフレームを過ぎたら再生終了
                this.isPlaying = false;
                clearInterval(updateInterval);
                if (this.speaker) {
                    this.speaker.end();
                }
                console.log('\nPlayback completed');
                process.exit(0);
            }
        }, 1000 / 30);  // 30fpsで更新

        // Ctrl+Cが押されたときの処理
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

// メイン関数
async function main() {
    // コマンドライン引数のチェック
    if (process.argv.length < 3) {
        console.error('Usage: node index.js <video-file>');
        process.exit(1);
    }

    const videoPath = process.argv[2];  // 動画ファイルのパス
    const videoName = videoPath.split('/').pop().split('.')[0];
    const asciiPath = `../output/${videoName}_frames.txt`;  // 動画名に基づくASCIIアートファイルのパス

    // ファイルの存在確認
    try {
        await fs.access(asciiPath);
        await fs.access(videoPath);
    } catch (error) {
        console.error(`Error: File not found: ${error.path}`);
        process.exit(1);
    }

    // プレイヤーを作成して再生開始
    const player = new ASCIIPlayer(asciiPath, videoPath);
    await player.play();
}

// メイン関数の実行
main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});