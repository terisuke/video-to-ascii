# 必要なライブラリをインポート
import cv2  # OpenCVライブラリ - 画像処理用
import numpy as np  # NumPyライブラリ - 数値計算用
from PIL import Image  # Pillowライブラリ - 画像処理用
import argparse  # コマンドライン引数を処理するためのライブラリ
from datetime import timedelta  # 時間計算用のライブラリ

# ASCIIアートに使用する文字を定義（左から右に向かって徐々に明るくなる）
ASCII_CHARS = "$#H&@*+=-:.  "

def format_timestamp(milliseconds):
    """
    ミリ秒をSRT形式のタイムスタンプ（00:00:00,000）に変換する関数
    例: 1234ミリ秒 → 00:00:01,234
    """
    t = timedelta(milliseconds=milliseconds)
    hours = int(t.total_seconds() // 3600)  # 時間を計算
    minutes = int((t.total_seconds() % 3600) // 60)  # 分を計算
    seconds = int(t.total_seconds() % 60)  # 秒を計算
    millis = int(t.microseconds / 1000)  # ミリ秒を計算
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

def resize_image(image, new_width=100):
    """
    画像のサイズを変更する関数
    アスペクト比を保ちながら、指定された幅にリサイズする
    高さは幅の半分にすることで、文字の縦横比を調整
    """
    width, height = image.size
    aspect_ratio = height/width
    new_height = int(aspect_ratio * new_width * 0.5)
    return image.resize((new_width, new_height))

def normalize_brightness(image):
    """
    画像の明るさを正規化する関数
    暗すぎる/明るすぎる画像を適切な明るさに調整
    """
    img_array = np.array(image)
    normalized = cv2.normalize(img_array, None, 0, 255, cv2.NORM_MINMAX)
    return Image.fromarray(normalized)

def pixels_to_ascii(image):
    """
    画像のピクセルをASCII文字に変換する関数
    各ピクセルの明るさに応じて、ASCII_CHARSから適切な文字を選択
    """
    pixels = image.getdata()
    ascii_str = ''
    for pixel in pixels:
        # ピクセルの明るさ(0-255)をASCII文字のインデックス(0-len(ASCII_CHARS))に変換
        index = int(pixel * (len(ASCII_CHARS) - 1) / 255)
        ascii_str += ASCII_CHARS[index]
    return ascii_str

def frame_to_ascii(frame, width=100):
    """
    1フレームをASCIIアートに変換する関数
    """
    # BGRからRGBに変換し、グレースケールに変換
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    image = image.convert('L')
    
    # 明るさを調整
    image = normalize_brightness(image)
    # コントラストを20%増加
    image = Image.fromarray(np.clip(np.array(image) * 1.2, 0, 255).astype('uint8'))
    # サイズを調整
    image = resize_image(image, width)
    # ASCII文字列に変換
    ascii_str = pixels_to_ascii(image)
    
    # 1行ごとに改行を入れて整形
    ascii_img = ''
    for i in range(0, len(ascii_str), width):
        ascii_img += ascii_str[i:i + width] + '\n'
    
    return ascii_img

def process_video(video_path, output_path, width=100):
    """
    動画を読み込んでASCIIアートに変換し、ファイルに保存する関数
    """
    # 動画ファイルを開く
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("動画ファイルを開けませんでした")

    # フレームレートを取得し、1フレームの時間を計算
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_time_ms = int(1000 / fps)  # ミリ秒単位

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            frame_count = 0
            while True:
                # フレームを1つ読み込む
                ret, frame = cap.read()
                if not ret:  # 読み込みに失敗したら終了
                    break

                # フレーム番号を書き込み
                f.write(f"{frame_count + 1}\n")

                # 開始時間と終了時間のタイムスタンプを書き込み
                start_time = frame_count * frame_time_ms
                end_time = (frame_count + 1) * frame_time_ms
                f.write(f"{format_timestamp(start_time)} --> {format_timestamp(end_time)}\n")

                # フレームをASCIIアートに変換して書き込み
                ascii_art = frame_to_ascii(frame, width)
                f.write(ascii_art)
                
                # フレーム間の区切りとして空行を挿入
                f.write('\n')

                frame_count += 1
                # 30フレームごとに進捗を表示
                if frame_count % 30 == 0:
                    print(f"Processed {frame_count} frames...")

    finally:
        # 終了時に必ずビデオキャプチャを解放
        cap.release()

def main():
    """
    メイン関数：コマンドライン引数を解析し、変換処理を実行
    """
    # コマンドライン引数の設定
    parser = argparse.ArgumentParser(description='動画をASCIIアートに変換する')
    parser.add_argument('input', help='入力動画のパス')
    parser.add_argument('--width', type=int, default=100, help='ASCII アートの幅')
    parser.add_argument('--output', default='../output/frames.txt', help='出力ファイルパス')
    
    # 引数を解析
    args = parser.parse_args()
    
    # 変換処理を実行
    try:
        process_video(args.input, args.output, args.width)
        print(f"変換が完了しました。結果は {args.output} に保存されました。")
    except Exception as e:
        print(f"エラーが発生しました: {str(e)}")

# スクリプトが直接実行された場合にのみmain()を実行
if __name__ == '__main__':
    main()