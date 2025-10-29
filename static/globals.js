// Global variables for neural network simulator
// Ensures all window.* variables are initialized before other scripts run

window.layernumber = 1; // Default number of hidden layers
window.activationtype = 'relu'; // Default activation function
window.initmethod = 'glorot'; // Default initialization method
window.neuronCounts = [2]; // Default neuron counts for hidden layers
window.learningRate = 0.01; // Default learning rate
window.momentum = 0.5; // Default momentum
window.epochs = 100; // Default epochs
window.earlyStopping = 0.01; // Default early stopping
window.points = []; // Used by main.js for training points
window.scene = null; // Used by main.js and nncalc.js for Three.js scene
window.THREE = null; // Used by main.js and nncalc.js for Three.js
window.predictionMesh = null; // Used by nncalc.js for prediction mesh

// You can add other global variables here as needed
window.weights = [];
window.biases = [];
