import cv2
import numpy as np
from PIL import Image
import argparse
from datetime import timedelta

# より細かい階調を表現するための文字セット（濃い順）
ASCII_CHARS = "$#H&@*+=-:.  "

def format_timestamp(milliseconds):
    """ミリ秒をSRT形式のタイムスタンプに変換"""
    t = timedelta(milliseconds=milliseconds)
    hours = int(t.total_seconds() // 3600)
    minutes = int((t.total_seconds() % 3600) // 60)
    seconds = int(t.total_seconds() % 60)
    millis = int(t.microseconds / 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

def resize_image(image, new_width=100):
    width, height = image.size
    aspect_ratio = height/width
    new_height = int(aspect_ratio * new_width * 0.5)
    return image.resize((new_width, new_height))

def normalize_brightness(image):
    img_array = np.array(image)
    normalized = cv2.normalize(img_array, None, 0, 255, cv2.NORM_MINMAX)
    return Image.fromarray(normalized)

def pixels_to_ascii(image):
    pixels = image.getdata()
    ascii_str = ''
    for pixel in pixels:
        index = int(pixel * (len(ASCII_CHARS) - 1) / 255)
        ascii_str += ASCII_CHARS[index]
    return ascii_str

def frame_to_ascii(frame, width=100):
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    image = image.convert('L')
    image = normalize_brightness(image)
    image = Image.fromarray(np.clip(np.array(image) * 1.2, 0, 255).astype('uint8'))
    image = resize_image(image, width)
    ascii_str = pixels_to_ascii(image)
    
    ascii_img = ''
    for i in range(0, len(ascii_str), width):
        ascii_img += ascii_str[i:i + width] + '\n'
    
    return ascii_img

def process_video(video_path, output_path, width=100):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("動画ファイルを開けませんでした")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_time_ms = int(1000 / fps)  # 1フレームの時間（ミリ秒）

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            frame_count = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # フレーム番号を書き込み
                f.write(f"{frame_count + 1}\n")

                # タイムスタンプを書き込み
                start_time = frame_count * frame_time_ms
                end_time = (frame_count + 1) * frame_time_ms
                f.write(f"{format_timestamp(start_time)} --> {format_timestamp(end_time)}\n")

                # ASCIIアートを書き込み
                ascii_art = frame_to_ascii(frame, width)
                f.write(ascii_art)
                
                # フレーム区切りの空行を書き込み
                f.write('\n')

                frame_count += 1
                if frame_count % 30 == 0:
                    print(f"Processed {frame_count} frames...")

    finally:
        cap.release()

def main():
    parser = argparse.ArgumentParser(description='動画をASCIIアートに変換する')
    parser.add_argument('input', help='入力動画のパス')
    parser.add_argument('--width', type=int, default=100, help='ASCII アートの幅')
    parser.add_argument('--output', default='../output/frames.txt', help='出力ファイルパス')
    
    args = parser.parse_args()
    
    try:
        process_video(args.input, args.output, args.width)
        print(f"変換が完了しました。結果は {args.output} に保存されました。")
    except Exception as e:
        print(f"エラーが発生しました: {str(e)}")

if __name__ == '__main__':
    main()