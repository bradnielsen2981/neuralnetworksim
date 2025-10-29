//-------- Canvas and Drawing Context --------//
const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
let neuronRadius = 40; // Will be dynamically set based on neuron count

//-------- Input Variables --------//
let inputX = 1; // X input
let inputZ = 1; // Z input
let inputNeuronPositions = [];
let hoveredInputNeuronIndex = null; // Track hovered input neuron
// New: track hover for any neuron (layer, index) and store positions for hover detection
let hoveredNeuron = { layer: null, index: null };
let neuronPositions = [];

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
    // Determine current activation to choose proper scaling for 'standard'
    const currentActivation = (typeof window !== 'undefined' && window.activationtype)
        ? String(window.activationtype).toLowerCase()
        : (document.getElementById('activation') ? String(document.getElementById('activation').value).toLowerCase() : 'relu');

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
                        // Scaled normal per activation:
                        // ReLU -> He: std = sqrt(2/fan_in)
                        // TanH -> Glorot-like per request: std = sqrt(1/fan_in)
                        {
                            const isRelu = (currentActivation === 'relu');
                            const std = Math.sqrt(isRelu ? (2 / Math.max(1, fan_in)) : (1 / Math.max(1, fan_in)));
                            weight = getNormalRandom() * std;
                        }
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
    const a = (activation || '').toLowerCase();
    if (a === 'relu') return Math.max(0, x);
    if (a === 'tanh') return Math.tanh(x);
    return x;
}

// Color helpers for activation-based shading
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function mixRGBArray(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}
function toCssRGB(arr) { return `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})`; }
function activationStrength(activation, outVal) {
    const a = (activation || '').toLowerCase();
    if (a === 'tanh') return clamp01(Math.abs(outVal));
    // relu and others: compress using tanh to keep bounded
    return clamp01(Math.tanh(Math.max(0, outVal) / 2));
}

//-------- Drawing Functions --------//
function drawInputNeuron(x, y, label, inputIndex) {
    ctx.beginPath();
    ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
    // Restore bright green hover color for input neurons
    if (hoveredNeuron.layer === 0 && hoveredNeuron.index === inputIndex) {
        ctx.fillStyle = '#39ff14'; // Bright green hover
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

    // Store position for click and hover detection
    inputNeuronPositions.push({x, y, radius: neuronRadius, index: inputIndex});
    neuronPositions.push({x, y, radius: neuronRadius, layer: 0, index: inputIndex});
}

// Draw neuron with activation curve
function drawNeuron(x, y, activation, inputVal, outputVal, layer, index) {
    ctx.beginPath();
    ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
    // Base: royalblue, then tint based on activation (more red when strong, more blue when weak)
    const baseBlue = [65, 105, 225];      // #4169e1
    const blueDeep = [30, 60, 180];       // deeper blue for weak activation
    const greyTint = [85, 85, 85];        // slight grey to dull very weak
    const redTint = [231, 76, 60];        // reddish for strong activation
    const isHovered = (hoveredNeuron.layer === layer && hoveredNeuron.index === index);

    const act = (activation || '').toLowerCase();
    let s = activationStrength(act, outputVal); // 0..1 strength
    let fillRGB = baseBlue.slice();
    // Push weak activations bluer (and only a touch greyer)
    fillRGB = mixRGBArray(fillRGB, blueDeep, (1 - s) * 0.30);
    fillRGB = mixRGBArray(fillRGB, greyTint, (1 - s) * 0.10);
    // Make strong activations more red than before
    fillRGB = mixRGBArray(fillRGB, redTint, s * 0.50);
    if (isHovered) {
        fillRGB = mixRGBArray(fillRGB, [255, 255, 255], 0.12);
    }
    ctx.fillStyle = toCssRGB(fillRGB);
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
        if (act === 'relu') {
            fx = t < 0 ? 0 : t * neuronRadius;
            fx -= neuronRadius * 0.2; // scale shift down
        } else if (act === 'tanh') {
            fx = neuronRadius * 0.4 * Math.tanh(4 * t * 0.9);
        } else {
            // default: small linear guide
            fx = neuronRadius * 0.2 * t;
        }
        points.push({ x: i, y: -fx });
    }
    ctx.moveTo(points[0].x + x, points[0].y + y);
    for (let p of points) ctx.lineTo(p.x + x, p.y + y);
    ctx.strokeStyle = '#000'; // Crisp black
    ctx.lineWidth = 2;
    ctx.stroke();

    // Input/Output numbers only, adaptive precision for small values
    const fmt = (v) => {
        const av = Math.abs(v);
        return av >= 0.01 ? v.toFixed(2) : v.toFixed(4);
    };
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(8, Math.floor(neuronRadius * 0.45))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${fmt(inputVal)}`, x - neuronRadius * 0.5 + 8, y - neuronRadius * 0.5 + 3);
    ctx.fillText(`${fmt(outputVal)}`, x + neuronRadius * 0.5 - 12, y + neuronRadius * 0.5 + 3);

    // Store position for hover detection
    neuronPositions.push({ x, y, radius: neuronRadius, layer, index });
}

// Draw a dedicated output neuron: 'Y' label above and numeric value inside
function drawOutputNeuron(x, y, value, layer, index) {
    ctx.beginPath();
    ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label above the circle: 'Y'
    ctx.fillStyle = '#000';
    ctx.font = `${Math.max(10, Math.floor(neuronRadius * 0.6))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Y', x, y - neuronRadius - 6);

    // Centered numeric value only (two decimals) inside the circle
    const fmt = (v) => v.toFixed(2);
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(10, Math.floor(neuronRadius * 0.55))}px sans-serif`;
    ctx.fillText(`${fmt(value)}`, x, y);

    // Track for hover detection consistency
    neuronPositions.push({ x, y, radius: neuronRadius, layer, index });
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
    // Use normalized inputs if training stored normalization stats
    let inX = inputX, inZ = inputZ;
    if (window.inputNorm && window.inputNorm.type === 'zscore' && Array.isArray(window.inputNorm.mean) && Array.isArray(window.inputNorm.std)) {
        const m = window.inputNorm.mean, s = window.inputNorm.std;
        const sx = (s[0] === 0 || !isFinite(s[0])) ? 1 : s[0];
        const sz = (s[1] === 0 || !isFinite(s[1])) ? 1 : s[1];
        inX = (inputX - m[0]) / sx;
        inZ = (inputZ - m[1]) / sz;
    }
    outputs.push([inX, inZ]);
    preActivations.push([inX, inZ]);

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
        const isOutputLayer = (l === layerSizes.length - 1);
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
            // No activation on output layer (linear output)
            const outVal = isOutputLayer ? sum : activate(sum, activation);
            layerOutput.push(outVal);
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
    neuronPositions = []; // Reset all neuron positions

    // Use global window variables for network configuration
    const numHiddenLayers = window.layernumber !== undefined ? window.layernumber : Math.min(4, Math.max(1, parseInt(document.getElementById('layers').value)));
    const activation = (window.activationtype !== undefined ? String(window.activationtype) : String(document.getElementById('activation').value)).toLowerCase();

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
                // Show raw input values in labels even if normalized internally
                const rawVals = [inputX, inputZ];
                drawInputNeuron(x, y, `${labels[n]}=${rawVals[n]}`, n);
            } else if (l === totalLayers - 1) {
                // Output neuron: white circle with Y inside
                const yVal = outputs[l][n];
                drawOutputNeuron(x, y, yVal, l, n);
            } else {
                drawNeuron(x, y, activation, preActivations[l][n], outputs[l][n], l, n);
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
    for (const neuron of neuronPositions) {
        const dx = mouseX - neuron.x;
        const dy = mouseY - neuron.y;
        if (Math.sqrt(dx*dx + dy*dy) <= neuron.radius) {
            found = { layer: neuron.layer, index: neuron.index };
            break;
        }
    }

    const changed = (hoveredNeuron.layer !== (found ? found.layer : null)) || (hoveredNeuron.index !== (found ? found.index : null));
    if (changed) {
        hoveredNeuron = found ? { layer: found.layer, index: found.index } : { layer: null, index: null };
        // Maintain legacy input hover index for compatibility (not used elsewhere now)
        hoveredInputNeuronIndex = (found && found.layer === 0) ? found.index : null;
        drawNetwork();
    }
});

// Remove highlight when mouse leaves canvas
canvas.addEventListener('mouseleave', () => {
    if (hoveredNeuron.layer !== null || hoveredNeuron.index !== null) {
        hoveredNeuron = { layer: null, index: null };
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
    window.activationtype = String(document.getElementById('activation').value).toLowerCase();
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
    window.momentum = 0.5;
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
            /* removed console warn to keep logs clean */
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