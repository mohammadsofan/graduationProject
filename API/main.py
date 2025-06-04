from fastapi import FastAPI, File, UploadFile, Form 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from tensorflow.keras.models import load_model
from tensorflow.keras.applications import DenseNet169, ResNet101
from tensorflow.keras.applications.densenet import preprocess_input as preprocess_densenet
from tensorflow.keras.applications.resnet import preprocess_input as preprocess_resnet
import numpy as np
from PIL import Image
import io
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace "*" with specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.on_event("startup")
def load_models():
    # Load models only once
    global models, fracture_model
    dense_model_1 = load_model("model_epoch09_val_loss0.2801.h5")
    dense_model_2 = load_model("model2_dense.h5")
    resnet_model_1 = load_model("resnet101_model_epoch19_val_loss0.2636.h5")
    resnet_model_2 = load_model("resnet101_model2.h5")
    fracture_model=load_model("fracture_model.h5")
    models = [
        (dense_model_1, preprocess_densenet),
        (dense_model_2, preprocess_densenet),
        (resnet_model_1, preprocess_resnet),
        (resnet_model_2, preprocess_resnet),
    ]

IMG_SIZE = (320, 320)

def prepare_image(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("L")  # Load as grayscale
    img = img.resize(IMG_SIZE)
    img = np.array(img, dtype=np.float32) / 255.0  # Normalize
    img = np.stack([img] * 3, axis=-1)  # Convert grayscale to RGB
    img = np.expand_dims(img, axis=0)  # Add batch dimension
    return img

# Binary sigmoid output: turn into 2-class softmax-like output
def sigmoid_to_softmax(sigmoid_output):
    return [1 - sigmoid_output, sigmoid_output]

def predict_ensemble(image_bytes_list: list[bytes]) -> dict:
    predictions = []

    for model, preprocess_fn in models:
        for image_bytes in image_bytes_list:
            img = prepare_image(image_bytes)
            pred = model.predict(img)[0][0]  # scalar sigmoid output
            softmax_like = sigmoid_to_softmax(pred)
            predictions.append(softmax_like)

    predictions = np.array(predictions)
    avg_softmax = np.mean(predictions, axis=0)
    predicted_class = int(np.argmax(avg_softmax))
    confidence = float(np.max(avg_softmax))

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "softmax": avg_softmax.tolist()
    }

def predict_fracture(image_bytes_list: list[bytes]) -> dict:
    predictions = []

    for image_bytes in image_bytes_list:
        img = prepare_image(image_bytes)
        pred = fracture_model.predict(img)[0][0]  # sigmoid output
        print(pred)
        softmax_like = sigmoid_to_softmax(pred)
        predictions.append(softmax_like)
    predictions = np.array(predictions)
    avg_softmax = np.mean(predictions, axis=0)
    predicted_class = int(np.argmax(avg_softmax))
    confidence = float(np.max(avg_softmax))

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "softmax": avg_softmax.tolist()
    }


@app.post("/predict/")
async def predict(images: list[UploadFile] = File(...),fracture: bool = Form(False)):
    contents = [await image.read() for image in images]
    result = predict_fracture(contents) if fracture else predict_ensemble(contents)
    return JSONResponse(content=result)