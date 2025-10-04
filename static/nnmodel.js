//-------- Canvas and Drawing Context --------//
const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
let neuronRadius = 40; // Will be dynamically set based on neuron count

//-------- Input Variables --------//
let inputX = 1; // X input
let inputZ = 1; // Z input
let inputNeuronPositions = [];

//-------- Network State Variables --------//
//-------- Network State Variables --------//
// weights and biases are now global (window.weights, window.biases)
let layerSizes = [];
window.neuronCounts = [2];
let lastNetworkStructure = "";

//-------- Random Number Helper --------//
let spareRandom = null;
function getNormalRandom() {
    if (spareRandom !== null) {
        const val = spareRandom;
        spareRandom = null;
        return val;
    }

    let u, v, s;
    do {
        u = Math.random() * 2 - 1;
        v = Math.random() * 2 - 1;
        s = u * u + v * v;
    } while (s >= 1 || s === 0);

    s = Math.sqrt(-2.0 * Math.log(s) / s);
    spareRandom = v * s;
    return u * s;
}

//-------- Network Initialization --------//
function initializeNetwork(hiddenNeuronCounts, initType) {
    layerSizes = [2, ...hiddenNeuronCounts, 1];

    window.weights = [];
    window.biases = [];
    for (let l = 0; l < layerSizes.length - 1; l++) {
        window.weights.push([]);
        window.biases.push([]);
        const fan_in = layerSizes[l];
        const fan_out = layerSizes[l + 1];

        for (let i = 0; i < fan_out; i++) {
            window.weights[l].push([]);
            let bias = 0;
            if (initType === 'random') {
                bias = Math.random() * 2 - 1;
            }
            window.biases[l].push(bias);

            for (let j = 0; j < fan_in; j++) {
                let weight = 0;
                switch (initType) {
                    case 'glorot':
                        const limit = Math.sqrt(6 / (fan_in + fan_out));
                        weight = (Math.random() * 2 - 1) * limit;
                        break;
                    case 'standard':
                        weight = getNormalRandom();
                        break;
                    case 'random':
                    default:
                        weight = Math.random() * 2 - 1;
                        break;
                }
                window.weights[l][i].push(weight);
            }
        }
    }
}


//-------- Activation Functions --------//
function activate(x, activation) {
    if (activation === 'relu') return Math.max(0, x);
    if (activation === 'sigmoid') return 1 / (1 + Math.exp(-x));
    if (activation === 'tanh') return Math.tanh(x);
    return x;
}

//-------- Drawing Functions --------//
function drawInputNeuron(x, y, label, inputIndex) {
    ctx.beginPath();
    ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = `${Math.max(10, Math.floor(neuronRadius * 0.6))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);

    // Store position for click detection
    inputNeuronPositions.push({x, y, radius: neuronRadius, index: inputIndex});
}

// Draw neuron with activation curve
function drawNeuron(x, y, activation, inputVal, outputVal) {
    ctx.beginPath();
    ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#cce';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Activation curve inside circle
    ctx.beginPath();
    const points = [];
    const step = neuronRadius / 10;
    for (let i = -neuronRadius; i <= neuronRadius; i += step) {
        let fx;
        const t = i / neuronRadius;
        if (activation === 'relu') {
            fx = t < 0 ? 0 : t * neuronRadius;
            fx -= neuronRadius * 0.2; // scale shift down
        } else if (activation === 'sigmoid') {
            fx = neuronRadius * 0.4 * (1 / (1 + Math.exp(-6 * t)) - 0.5);
        } else if (activation === 'tanh') {
            fx = neuronRadius * 0.4 * Math.tanh(4 * t * 0.9);
        }
        points.push({ x: i, y: -fx });
    }
    ctx.moveTo(points[0].x + x, points[0].y + y);
    for (let p of points) ctx.lineTo(p.x + x, p.y + y);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Input/Output text inside neuron
    ctx.fillStyle = '#000';
    ctx.font = `${Math.max(8, Math.floor(neuronRadius * 0.45))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`I: ${inputVal.toFixed(2)}`, x - neuronRadius * 0.5 + 8, y - neuronRadius * 0.5 + 3);
    ctx.fillText(`O: ${outputVal.toFixed(2)}`, x + neuronRadius * 0.5 - 12, y + neuronRadius * 0.5 + 3);
}

// Draw connections
function drawConnection(x1, y1, x2, y2, weight, bias, inputIndex) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Adjust text position for the second input
    const textOffsetFactor = (inputIndex === 1) ? 0.35 : 0.5;
    const midX = x1 + (x2 - x1) * textOffsetFactor;
    const midY = y1 + (y2 - y1) * textOffsetFactor;

    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    ctx.fillStyle = 'blue';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`w=${weight.toFixed(2)}`, 0, -6);
    ctx.fillStyle = 'red';
    ctx.fillText(`b=${bias.toFixed(2)}`, 0, 6);
    ctx.restore();
}

//-------- Forward Pass --------//
function forwardPass(layerSizes, activation) {
    let outputs = [];
    let preActivations = [];
    outputs.push([inputX, inputZ]);
    preActivations.push([inputX, inputZ]);

    for (let l = 1; l < layerSizes.length; l++) {
        let layerOutput = [];
        let layerPreAct = [];
        for (let i = 0; i < layerSizes[l]; i++) {
            let sum = window.biases[l - 1][i];
            for (let j = 0; j < layerSizes[l - 1]; j++) {
                sum += outputs[l - 1][j] * window.weights[l - 1][i][j];
            }
            layerPreAct.push(sum);
            layerOutput.push(activate(sum, activation));
        }
        preActivations.push(layerPreAct);
        outputs.push(layerOutput);
    }
    return { outputs, preActivations };
}

//-------- Layer Controls --------//
function drawLayerControls(totalLayers, layerSpacing, leftOffset) {
    const container = document.getElementById('canvasContainer');
    container.querySelectorAll('.layer-control').forEach(el => el.remove());

    for (let l = 1; l < totalLayers - 1; l++) {
        const layerIndex = l - 1;
        const x = (leftOffset + l * layerSpacing) + 30;

        const controlDiv = document.createElement('div');
        controlDiv.className = 'layer-control';
        controlDiv.style.left = `${x}px`;

        const minusBtn = document.createElement('button');
        minusBtn.textContent = '-';
        minusBtn.onclick = () => {
            window.neuronCounts[layerIndex] = Math.max(1, window.neuronCounts[layerIndex] - 1);
            drawNetwork();
        };

        const countSpan = document.createElement('span');
        countSpan.textContent = window.neuronCounts[layerIndex];

        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.onclick = () => {
            window.neuronCounts[layerIndex] = Math.min(16, window.neuronCounts[layerIndex] + 1);
            drawNetwork();
        };

        controlDiv.appendChild(minusBtn);
        controlDiv.appendChild(countSpan);
        controlDiv.appendChild(plusBtn);
        container.appendChild(controlDiv);
    }
}


//-------- Draw Full Network --------//
function drawNetwork() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    inputNeuronPositions = []; // Reset input neuron positions on each redraw

    // Use global window variables for network configuration
    const numHiddenLayers = window.layernumber !== undefined ? window.layernumber : Math.min(4, Math.max(1, parseInt(document.getElementById('layers').value)));
    const activation = window.activationtype !== undefined ? window.activationtype : document.getElementById('activation').value;
    const initType = window.initmethod !== undefined ? window.initmethod : document.getElementById('initialization').value;

    while (window.neuronCounts.length < numHiddenLayers) {
        window.neuronCounts.push(2);
    }
    window.neuronCounts.length = numHiddenLayers;

    // A change in structure or init type will trigger re-initialization
    const currentNetworkStructure = `${initType}-${JSON.stringify(window.neuronCounts)}`;
    if (lastNetworkStructure !== currentNetworkStructure) {
        initializeNetwork(window.neuronCounts, initType);
        lastNetworkStructure = currentNetworkStructure;
    }

    const { outputs, preActivations } = forwardPass(layerSizes, activation);

    const totalLayers = layerSizes.length;
    const totalSpacing = canvas.width - 100;
    const layerSpacing = totalSpacing / (totalLayers - 1);
    const leftOffset = 50;

    // Find the largest layer for scaling
    const maxNeurons = Math.max(...layerSizes);
    // Scale neuron radius so all neurons fit, clamp between 16 and 40
    neuronRadius = Math.max(16, Math.min(40, Math.floor((canvas.height - 40) / (maxNeurons * 2))));

    drawLayerControls(totalLayers, layerSpacing, leftOffset);

    // Draw connections first
    for (let l = 0; l < totalLayers - 1; l++) {
        const neuronSpacing1 = canvas.height / (layerSizes[l] + 1);
        const neuronSpacing2 = canvas.height / (layerSizes[l + 1] + 1);
        const x1 = leftOffset + l * layerSpacing;
        const x2 = leftOffset + (l + 1) * layerSpacing;
        for (let i = 0; i < layerSizes[l]; i++) {
            for (let j = 0; j < layerSizes[l + 1]; j++) {
                drawConnection(x1, (i + 1) * neuronSpacing1, x2, (j + 1) * neuronSpacing2, window.weights[l][j][i], window.biases[l][j], i);
            }
        }
    }

    // Draw neurons
    for (let l = 0; l < totalLayers; l++) {
        const x = leftOffset + l * layerSpacing;
        const neuronSpacing = canvas.height / (layerSizes[l] + 1);
        for (let n = 0; n < layerSizes[l]; n++) {
            const y = (n + 1) * neuronSpacing;
            if (l === 0) {
                const labels = ["X", "Z"];
                drawInputNeuron(x, y, `${labels[n]}=${outputs[0][n]}`, n);
            } else {
                drawNeuron(x, y, activation, preActivations[l][n], outputs[l][n]);
            }
        }
    }
}

//-------- Canvas Click Event Listener --------//
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    for (const neuron of inputNeuronPositions) {
        const distance = Math.sqrt(Math.pow(clickX - neuron.x, 2) + Math.pow(clickY - neuron.y, 2));
        if (distance <= neuron.radius) {
            let currentValue = (neuron.index === 0) ? inputX : inputZ;
            const newValue = prompt(`Enter a new value for ${neuron.index === 0 ? 'X' : 'Z'}:`, currentValue);
            if (newValue !== null) {
                const parsedValue = parseFloat(newValue);
                if (!isNaN(parsedValue)) {
                    if (neuron.index === 0) {
                        inputX = parsedValue;
                    } else {
                        inputZ = parsedValue;
                    }
                    drawNetwork();
                }
            }
            return; // Exit loop after handling a click
        }
    }
});

//-------- UI Event Listeners --------//
document.getElementById('layers').addEventListener('input', function() {
    window.layernumber = Math.min(4, Math.max(1, parseInt(document.getElementById('layers').value)));
    // Only add or remove layers, preserve neuron counts in existing layers
    if (window.neuronCounts.length < window.layernumber) {
        while (window.neuronCounts.length < window.layernumber) {
            window.neuronCounts.push(2);
        }
    } else if (window.neuronCounts.length > window.layernumber) {
        window.neuronCounts.length = window.layernumber;
    }
    drawNetwork();
});
document.getElementById('activation').addEventListener('change', function() {
    window.activationtype = document.getElementById('activation').value;
    drawNetwork();
});
document.getElementById('initialization').addEventListener('change', function() {
    window.initmethod = document.getElementById('initialization').value;
    drawNetwork();
});

// NN parameter event listeners
document.getElementById('learning-rate').addEventListener('input', function() {
    window.learningRate = parseFloat(document.getElementById('learning-rate').value);
});
document.getElementById('momentum').addEventListener('input', function() {
    window.momentum = parseFloat(document.getElementById('momentum').value);
});
document.getElementById('epochs').addEventListener('input', function() {
    window.epochs = parseInt(document.getElementById('epochs').value);
});
document.getElementById('earlystopping').addEventListener('input', function() {
    window.earlyStopping = parseFloat(document.getElementById('earlystopping').value);
});
document.getElementById('resetButton').addEventListener('click', () => {
    // Log all window variables before reset
    console.log({
        layernumber: window.layernumber,
        activationtype: window.activationtype,
        initmethod: window.initmethod,
    neuronCounts: window.neuronCounts,
        learningRate: window.learningRate,
        momentum: window.momentum,
        epochs: window.epochs,
        earlyStopping: window.earlyStopping,
        points: window.points,
        predictionMesh: window.predictionMesh,
        scene: window.scene,
        THREE: window.THREE
    });

    // Reset all window variables except scene and THREE
    window.layernumber = 1;
    document.getElementById('layers').value = 1;
    window.activationtype = 'relu';
    window.initmethod = 'glorot';
    window.neuronCounts = [2];
    window.learningRate = 0.01;
    window.momentum = 0.9;
    window.epochs = 100;
    window.earlyStopping = 0.01;
    window.points = [];
    window.predictionMesh = null;
    // window.scene and window.THREE are preserved

    // Force re-initialization on next draw call
    lastNetworkStructure = "";
    drawNetwork();
});

//-------- Initial Draw --------//
drawNetwork();