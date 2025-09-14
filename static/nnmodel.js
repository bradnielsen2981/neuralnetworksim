const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
const neuronRadius = 40;

// Change to `let` so values can be modified
let inputX = 1; // X input
let inputZ = 1; // Z input
// Store the positions of input neurons to handle clicks
let inputNeuronPositions = [];

let weights = [];
let biases = [];
let layerSizes = [];
let neuronCounts = [2];
let lastNetworkStructure = "";

// Helper for Standard Normal distribution (Box-Muller transform)
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

// Initialize weights and biases based on a dynamic array of hidden layer sizes and init type
function initializeNetwork(hiddenNeuronCounts, initType) {
    layerSizes = [2, ...hiddenNeuronCounts, 1];

    weights = [];
    biases = [];
    for (let l = 0; l < layerSizes.length - 1; l++) {
        weights.push([]);
        biases.push([]);
        const fan_in = layerSizes[l];
        const fan_out = layerSizes[l + 1];

        for (let i = 0; i < fan_out; i++) {
            weights[l].push([]);
            let bias = 0;
            if (initType === 'random') {
                bias = Math.random() * 2 - 1;
            }
            biases[l].push(bias);

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
                weights[l][i].push(weight);
            }
        }
    }
}


// Activation functions
function activate(x, activation) {
    if (activation === 'relu') return Math.max(0, x);
    if (activation === 'sigmoid') return 1 / (1 + Math.exp(-x));
    if (activation === 'tanh') return Math.tanh(x);
    return x;
}

// Draw input neuron
function drawInputNeuron(x, y, label, inputIndex) {
    ctx.beginPath();
    ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = '16px sans-serif';
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
            fx -= 8; // shift down
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
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`I: ${inputVal.toFixed(2)}`, x - neuronRadius / 2 + 10, y - neuronRadius / 2 + 3);
    ctx.fillText(`O: ${outputVal.toFixed(2)}`, x + neuronRadius / 2 - 15, y + neuronRadius / 2 + 3);
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

// Forward pass with pre-activation storage
function forwardPass(layerSizes, activation) {
    let outputs = [];
    let preActivations = [];
    outputs.push([inputX, inputZ]);
    preActivations.push([inputX, inputZ]);

    for (let l = 1; l < layerSizes.length; l++) {
        let layerOutput = [];
        let layerPreAct = [];
        for (let i = 0; i < layerSizes[l]; i++) {
            let sum = biases[l - 1][i];
            for (let j = 0; j < layerSizes[l - 1]; j++) {
                sum += outputs[l - 1][j] * weights[l - 1][i][j];
            }
            layerPreAct.push(sum);
            layerOutput.push(activate(sum, activation));
        }
        preActivations.push(layerPreAct);
        outputs.push(layerOutput);
    }
    return { outputs, preActivations };
}

// Draw the +/- controls above each hidden layer
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
            neuronCounts[layerIndex] = Math.max(1, neuronCounts[layerIndex] - 1);
            drawNetwork();
        };

        const countSpan = document.createElement('span');
        countSpan.textContent = neuronCounts[layerIndex];

        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.onclick = () => {
            neuronCounts[layerIndex] = Math.min(4, neuronCounts[layerIndex] + 1);
            drawNetwork();
        };

        controlDiv.appendChild(minusBtn);
        controlDiv.appendChild(countSpan);
        controlDiv.appendChild(plusBtn);
        container.appendChild(controlDiv);
    }
}


// Draw full network
function drawNetwork() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    inputNeuronPositions = []; // Reset input neuron positions on each redraw

    const numHiddenLayers = Math.min(4, Math.max(1, parseInt(document.getElementById('layers').value)));
    const activation = document.getElementById('activation').value;
    const initType = document.getElementById('initialization').value;

    while (neuronCounts.length < numHiddenLayers) {
        neuronCounts.push(2);
    }
    neuronCounts.length = numHiddenLayers;

    // A change in structure or init type will trigger re-initialization
    const currentNetworkStructure = `${initType}-${JSON.stringify(neuronCounts)}`;
    if (lastNetworkStructure !== currentNetworkStructure) {
        initializeNetwork(neuronCounts, initType);
        lastNetworkStructure = currentNetworkStructure;
    }

    const { outputs, preActivations } = forwardPass(layerSizes, activation);

    const totalLayers = layerSizes.length;
    const totalSpacing = canvas.width - 100;
    const layerSpacing = totalSpacing / (totalLayers - 1);
    const leftOffset = 50;

    drawLayerControls(totalLayers, layerSpacing, leftOffset);

    // Draw connections first
    for (let l = 0; l < totalLayers - 1; l++) {
        const neuronSpacing1 = canvas.height / (layerSizes[l] + 1);
        const neuronSpacing2 = canvas.height / (layerSizes[l + 1] + 1);
        const x1 = leftOffset + l * layerSpacing;
        const x2 = leftOffset + (l + 1) * layerSpacing;
        for (let i = 0; i < layerSizes[l]; i++) {
            for (let j = 0; j < layerSizes[l + 1]; j++) {
                drawConnection(x1, (i + 1) * neuronSpacing1, x2, (j + 1) * neuronSpacing2, weights[l][j][i], biases[l][j], i);
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

// Event listener for canvas clicks
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

// Event Listeners
document.getElementById('layers').addEventListener('input', drawNetwork);
document.getElementById('activation').addEventListener('change', drawNetwork);
document.getElementById('initialization').addEventListener('change', drawNetwork);

document.getElementById('resetButton').addEventListener('click', () => {
    // Force re-initialization on next draw call
    lastNetworkStructure = "";
    drawNetwork();
});

// Initial draw
drawNetwork();