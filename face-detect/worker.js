/* Face detection Web Worker using face-api.js */

// Worker には window/document がないので face-api.js の環境チェック用にシムを設定
self.window = self;
self.document = {
  createElement: () => ({ getContext: () => null }),
  createElementNS: () => ({ getContext: () => null }),
};
self.HTMLCanvasElement = OffscreenCanvas;
self.HTMLImageElement = class HTMLImageElement {};
self.HTMLVideoElement = class HTMLVideoElement {};

importScripts("https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.min.js");

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/";
let modelLoaded = false;

// モデルの事前読み込み
async function loadModels() {
  if (modelLoaded) return;
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  modelLoaded = true;
}

// ImageBitmap から顔検出を実行
async function detectFaces(imageBitmap) {
  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imageBitmap, 0, 0);

  const detections = await faceapi.detectAllFaces(
    canvas,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.4 })
  );

  // Transferable-friendly な結果に変換（box + score のプレーンオブジェクト）
  return detections.map(d => ({
    score: d.score,
    box: {
      x: d.box.x,
      y: d.box.y,
      width: d.box.width,
      height: d.box.height,
    },
  }));
}

// メッセージハンドラ
self.onmessage = async (e) => {
  const { type, imageBitmap } = e.data;

  if (type === "load") {
    try {
      await loadModels();
      self.postMessage({ type: "loaded" });
    } catch (err) {
      self.postMessage({ type: "error", message: "Model load failed: " + err.message });
    }
    return;
  }

  if (type === "detect") {
    try {
      await loadModels();
      const results = await detectFaces(imageBitmap);
      imageBitmap.close();
      self.postMessage({ type: "detected", faces: results });
    } catch (err) {
      self.postMessage({ type: "error", message: "Detection failed: " + err.message });
    }
    return;
  }
};
