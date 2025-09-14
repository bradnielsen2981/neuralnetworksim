import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import time

# 1. Create random dataset of 20 points
num_points = 16
x = np.random.uniform(-20, 20, num_points)
z = np.random.uniform(-20, 20, num_points)
y = np.random.uniform(-5, 5, num_points)

X = np.column_stack((x, z))
Y = y

# 2. Build model: 3 layers, 8 neurons each
model = keras.Sequential([
    keras.Input(shape=(2,)),
    layers.Dense(16, activation='relu'),
    layers.Dense(16, activation='relu'),
    layers.Dense(16, activation='relu'),
    layers.Dense(1)
])

# 3. Compile with small learning rate
optimizer = keras.optimizers.Adam(learning_rate=0.001)
model.compile(optimizer=optimizer, loss='mse')

t = time.time()
# 4. Train longer to ensure memorization
model.fit(X, Y, epochs=2000, verbose=0)
print(f"Training completed in {time.time() - t:.2f} seconds")

# 5. Predict on training points
predictions = model.predict(X, verbose=0)


# 6. Print results with correctness check
threshold = 0.1
print("--- Predictions on training points ---")
for true_y, pred in zip(Y, predictions):
    pred_y = pred[0]
    correct = abs(pred_y - true_y) <= threshold
    status = "✅ Correct" if correct else "❌ Incorrect"
    print(f"Predicted: {pred_y:7.3f} | True: {true_y:7.3f} | {status}")

print(f"Prediction completed in {time.time() - t:.2f} seconds")