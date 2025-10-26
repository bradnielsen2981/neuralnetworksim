//-------- Canvas and Drawing Context --------//
const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
let neuronRadius = 40; // Will be dynamically set based on neuron count

//-------- Input Variables --------//
let inputX = 1; // X input
let inputZ = 1; // Z input
let inputNeuronPositions = [];
let hoveredInputNeuronIndex = null; // Track hovered input neuron

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
    //alert('Reinitializing network weights and biases...');
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
    // Highlight if hovered
    if (hoveredInputNeuronIndex === inputIndex) {
        ctx.fillStyle = '#39ff14'; // Bright green
    } else {
        ctx.fillStyle = '#fff';
    }
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
    ctx.fillStyle = '#007fff'; // Azure blue
    ctx.fill();
    ctx.strokeStyle = '#000'; // Crisp black
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
    ctx.strokeStyle = '#000'; // Crisp black
    ctx.lineWidth = 2;
    ctx.stroke();

    // Input/Output numbers only, font color white
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(8, Math.floor(neuronRadius * 0.45))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${inputVal.toFixed(2)}`, x - neuronRadius * 0.5 + 8, y - neuronRadius * 0.5 + 3);
    ctx.fillText(`${outputVal.toFixed(2)}`, x + neuronRadius * 0.5 - 12, y + neuronRadius * 0.5 + 3);
}

// Draw connections
function drawConnection(x1, y1, x2, y2, weight, bias, inputIndex) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#000'; // Crisp black
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
    ctx.restore();
}

//-------- Forward Pass --------//
function forwardPass(layerSizes, activation) {
    let outputs = [];
    let preActivations = [];
    outputs.push([inputX, inputZ]);
    preActivations.push([inputX, inputZ]);

    // Validate weights and biases shape
    for (let l = 1; l < layerSizes.length; l++) {
        if (!window.weights[l - 1] || !window.biases[l - 1]) {
            alert('Network weights/biases are not initialized for layer ' + (l - 1) + '. Reinitializing network.');
            initializeNetwork(window.neuronCounts, window.initmethod);
            return { outputs: [], preActivations: [] };
        }
        if (
            window.weights[l - 1].length !== layerSizes[l] ||
            window.biases[l - 1].length !== layerSizes[l]
        ) {
            alert('Network weights/biases shape mismatch for layer ' + (l - 1) + '. Reinitializing network.');
            initializeNetwork(window.neuronCounts, window.initmethod);
            return { outputs: [], preActivations: [] };
        }
        let layerOutput = [];
        let layerPreAct = [];
        for (let i = 0; i < layerSizes[l]; i++) {
            let sum = window.biases[l - 1][i];
            if (!window.weights[l - 1][i] || window.weights[l - 1][i].length !== layerSizes[l - 1]) {
                alert('Network weights shape mismatch for neuron ' + i + ' in layer ' + (l - 1) + '. Reinitializing network.');
                initializeNetwork(window.neuronCounts, window.initmethod);
                return { outputs: [], preActivations: [] };
            }
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
            initializeNetwork(window.neuronCounts, window.initmethod);
            drawNetwork();
        };

        const countSpan = document.createElement('span');
        countSpan.textContent = window.neuronCounts[layerIndex];

        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.onclick = () => {
            window.neuronCounts[layerIndex] = Math.min(16, window.neuronCounts[layerIndex] + 1);
            initializeNetwork(window.neuronCounts, window.initmethod);
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

    // Build layerSizes from window.neuronCounts
    const layerSizes = [2, ...window.neuronCounts, 1];
    const { outputs, preActivations } = forwardPass(layerSizes, activation);
    // Save output value to window.y
    if (outputs && outputs.length > 0 && outputs[outputs.length - 1].length > 0) {
        window.y = outputs[outputs.length - 1][0];
    }

    const totalLayers = layerSizes.length;
    const totalSpacing = canvas.width - 100;
    const layerSpacing = totalSpacing / (totalLayers - 1);
    const leftOffset = 50;

    // Find the largest layer for scaling
    const maxNeurons = Math.max(...layerSizes);
    // Scale neuron radius so all neurons fit, clamp between 16 and 40
    neuronRadius = Math.max(16, Math.min(40, Math.floor((canvas.height - 40) / (maxNeurons * 2))));

    drawLayerControls(totalLayers, layerSpacing, leftOffset);

    // Draw connections with convergence per target neuron and bias only after convergence
    for (let l = 0; l < totalLayers - 1; l++) {
        const neuronSpacing1 = canvas.height / (layerSizes[l] + 1);
        const neuronSpacing2 = canvas.height / (layerSizes[l + 1] + 1);
        const x1 = leftOffset + l * layerSpacing;
        const x2 = leftOffset + (l + 1) * layerSpacing;
    // Gap before neuron edge where incoming lines converge (short segment to neuron)
    // Move convergence closer to the next neuron: use a short fixed gap (~15px)
    const convergeGap = 15;
        for (let j = 0; j < layerSizes[l + 1]; j++) {
            const y2 = (j + 1) * neuronSpacing2;
            const convergeX = x2 - neuronRadius - convergeGap;
            // Incoming lines from all source neurons converge to (convergeX, y2)
            for (let i = 0; i < layerSizes[l]; i++) {
                const y1 = (i + 1) * neuronSpacing1;
                drawConnection(
                    x1,
                    y1,
                    convergeX,
                    y2,
                    window.weights[l][j][i],
                    window.biases[l][j],
                    i
                );
            }
            // Short line from convergence point to neuron edge
            const connectEndX = x2 - neuronRadius; // cut at neuron border
            ctx.beginPath();
            ctx.moveTo(convergeX, y2);
            ctx.lineTo(connectEndX, y2);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Bias label above the short connecting line (only once per target neuron)
            const biasVal = window.biases[l][j];
            ctx.fillStyle = 'red';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            const biasLabelX = connectEndX - 30; // anchor left of neuron edge
            ctx.fillText(`b=${biasVal.toFixed(2)}`, biasLabelX, y2 - 10);
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
                    let updated = false;
                    if (neuron.index === 0) {
                        inputX = parsedValue;
                        window.x = parsedValue;
                        updated = true;
                    } else {
                        inputZ = parsedValue;
                        window.z = parsedValue;
                        updated = true;
                    }
                    // After setting, do a forward pass and redraw
                    drawNetwork();
                    if (updated) {
                        addRedPointToThree(window.x, window.y, window.z);
                    }
                }
            }
            return; // Exit loop after handling a click
        }
    }

// Helper to add a red point in THREE.js canvas
function addRedPointToThree(x, y, z) {
    if (!window.scene || !window.THREE) return;
    // Remove previous red point if exists
    if (window.redPoint) {
        window.scene.remove(window.redPoint);
        window.redPoint.geometry.dispose();
        window.redPoint.material.dispose();
        window.redPoint = null;
    }
    // Try to match the size of other points (use predictionMesh or default to 0.15)
    let sphereRadius = 0.35;
    if (window.predictionMesh && window.predictionMesh.geometry && window.predictionMesh.geometry.parameters && window.predictionMesh.geometry.parameters.radius) {
        sphereRadius = window.predictionMesh.geometry.parameters.radius;
    }
    const geometry = new window.THREE.SphereGeometry(sphereRadius, 16, 16);
    const material = new window.THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new window.THREE.Mesh(geometry, material);
    sphere.position.set(x, y, z);
    window.scene.add(sphere);
    window.redPoint = sphere;
}
});

//-------- Canvas Mouse Move Event Listener for Highlight --------//
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    let found = null;
    for (const neuron of inputNeuronPositions) {
        const distance = Math.sqrt(Math.pow(mouseX - neuron.x, 2) + Math.pow(mouseY - neuron.y, 2));
        if (distance <= neuron.radius) {
            found = neuron.index;
            break;
        }
    }
    if (hoveredInputNeuronIndex !== found) {
        hoveredInputNeuronIndex = found;
        drawNetwork();
    }
});

// Remove highlight when mouse leaves canvas
canvas.addEventListener('mouseleave', () => {
    if (hoveredInputNeuronIndex !== null) {
        hoveredInputNeuronIndex = null;
        drawNetwork();
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
    initializeNetwork(window.neuronCounts, window.initmethod);
    drawNetwork();
});
document.getElementById('activation').addEventListener('change', function() {
    window.activationtype = document.getElementById('activation').value;
    initializeNetwork(window.neuronCounts, window.initmethod);
    drawNetwork();
});
document.getElementById('initialization').addEventListener('change', function() {
    window.initmethod = document.getElementById('initialization').value;
    initializeNetwork(window.neuronCounts, window.initmethod);
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
// Patience input tracking (optional global)
const patienceEl = document.getElementById('patience');
if (patienceEl) {
    patienceEl.addEventListener('input', function() {
        window.patience = parseInt(document.getElementById('patience').value);
    });
}
document.getElementById('resetButton').addEventListener('click', () => {
    // Removed console.log
    // ...existing code...

    // Reset all window variables except scene and THREE
    window.layernumber = 1;
    document.getElementById('layers').value = 1;
    window.activationtype = 'relu';
    window.initmethod = 'glorot';
    window.neuronCounts = [2];
    window.learningRate = 0.01;
    window.momentum = 0;
    window.epochs = 100;
    window.earlyStopping = 0.01;
    window.patience = 50;
    if (document.getElementById('patience')) {
        document.getElementById('patience').value = 50;
    }
    // Do NOT clear points; preserve user-added/generate points
    // Remove prediction mesh from the scene if present
    if (window.predictionMesh && window.scene) {
        try {
            window.scene.remove(window.predictionMesh);
            if (window.predictionMesh.geometry) window.predictionMesh.geometry.dispose();
            if (window.predictionMesh.material) window.predictionMesh.material.dispose();
        } catch (e) {
            console.warn('Error removing prediction mesh:', e);
        }
        window.predictionMesh = null;
    }
    // window.scene and window.THREE are preserved

    const initType = window.initmethod !== undefined ? window.initmethod : document.getElementById('initialization').value;
    initializeNetwork(window.neuronCounts, initType);
    
    drawNetwork();
});

// Reinitialise Network button: reinitialise weights/biases using current settings
const reinitBtnEl = document.getElementById('reinitButton');
if (reinitBtnEl) {
    reinitBtnEl.addEventListener('click', () => {
        // Use current neuron counts and selected init method
        const currentInit = window.initmethod !== undefined ? window.initmethod : document.getElementById('initialization').value;
        initializeNetwork(window.neuronCounts, currentInit);
        drawNetwork();
    });
}

//-------- Initial Draw --------//


initializeNetwork(window.neuronCounts, window.initmethod);
drawNetwork();

// Expose redrawNetwork globally
window.redrawNetwork = function() {
    drawNetwork();
};