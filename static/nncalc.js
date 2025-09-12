

import * as tf from '@tensorflow/tfjs';

// Helper to get network structure from nnmodel.js controls
function getNetworkStructure() {
    // Get number of hidden layers and neurons per layer from the UI controls
    const numHiddenLayers = Math.min(4, Math.max(1, parseInt(document.getElementById('layers').value)));
    const neuronCounts = [];
    for (let i = 0; i < numHiddenLayers; i++) {
        // Try to get neuron count from nnmodel.js state, fallback to 2 if not found
        const layerControl = document.querySelectorAll('.layer-control span')[i];
        neuronCounts.push(layerControl ? parseInt(layerControl.textContent) : 2);
    }
    return neuronCounts;
}

// Helper to get activation function
function getActivation() {
    return document.getElementById('activation').value;
}

// Helper to get points data from main.js
function getPointsData() {
    // main.js attaches points to window for sharing
    return window.points || [];
}

// Helper to get learning parameters from form
function getLearningParams() {
    return {
        learningRate: parseFloat(document.getElementById('learning-rate').value),
        momentum: parseFloat(document.getElementById('momentum').value),
        epochs: parseInt(document.getElementById('epochs').value),
        earlyStopping: parseFloat(document.getElementById('earlystopping').value)
    };
}

// Build and train the model
async function trainModelFromUI() {
    // Get network structure from nnmodel.js controls
    const neuronCounts = getNetworkStructure();
    const activation = getActivation();
    const { learningRate, momentum, epochs } = getLearningParams();

    // Prepare data from main.js points
    const points = getPointsData();
    if (!points.length) {
        alert("No points to train on!");
        return;
    }
    // X: [ [x, z], ... ]   Y: [ [y], ... ]
    const xs = points.map(pt => [pt.x, pt.z]);
    const ys = points.map(pt => [pt.y]);

    // Build model with the same structure as nnmodel.js
    const model = tf.sequential();
    if (neuronCounts.length > 0) {
        // First hidden layer with input shape
        model.add(tf.layers.dense({
            units: neuronCounts[0],
            inputShape: [2],
            activation: activation
        }));
        // Additional hidden layers
        for (let i = 1; i < neuronCounts.length; i++) {
            model.add(tf.layers.dense({
                units: neuronCounts[i],
                activation: activation
            }));
        }
        // Output layer
        model.add(tf.layers.dense({ units: 1 }));
    } else {
        // No hidden layers, just input to output
        model.add(tf.layers.dense({ units: 1, inputShape: [2] }));
    }

    // Compile
    model.compile({
        loss: 'meanSquaredError',
        optimizer: tf.train.sgd(learningRate)
    });

    // Train
    await model.fit(tf.tensor2d(xs), tf.tensor2d(ys), { epochs });
    alert("Training complete!");
}

// Attach event listener to train button
document.getElementById('train-btn').addEventListener('click', trainModelFromUI);
