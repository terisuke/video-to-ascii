.PHONY: convert play run clean install-deps setup-venv

# デフォルトの入力ファイル
INPUT_VIDEO ?= samples/rakisuta.mp4

# Python仮想環境のパス
VENV = converter/venv
PYTHON = ${VENV}/bin/python
PYTHON_VERSION = python3.11

# 仮想環境のセットアップ
setup-venv:
	cd converter && $(PYTHON_VERSION) -m venv venv

# 依存関係のインストール
install-deps: setup-venv
	cd converter && . venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt

# 変換処理
convert: install-deps
	cd converter && . venv/bin/activate && python src/converter.py ../$(INPUT_VIDEO)

# 再生処理
play:
	cd player && node src/index.js ../$(INPUT_VIDEO)

# 変換から再生まで一括実行
run: convert play

# 出力ファイルのクリーン
clean:
	rm -f output/*.txt

# 完全クリーン（仮想環境も削除）
clean-all: clean
	rm -rf converter/venv