// Helper to get network structure from nnmodel.js controls
function getNetworkStructure() {
    // Get number of hidden layers and neurons per layer from the UI controls
    // Read neuron counts directly from window.neuronCounts, fallback to [2] if not available
    if (Array.isArray(window.neuronCounts) && window.neuronCounts.length > 0) {
        return window.neuronCounts.slice();
    } else {
        return [2];
    }
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
    const lrInput = document.getElementById('learning-rate');
    let lr = parseFloat(lrInput.value);
    let mom = parseFloat(document.getElementById('momentum').value);
    if (!isFinite(mom)) mom = 0;
    // Clamp momentum to [0, 1]
    mom = Math.max(0, Math.min(1, mom));
    const epochsInput = document.getElementById('epochs');
    let ep = parseInt(epochsInput.value);
    const esInput = document.getElementById('earlystopping');
    let es = parseFloat(esInput.value);
    const patienceInput = document.getElementById('patience');
    let pat = parseInt((patienceInput && patienceInput.value) || 50);

    // Enforce hard maximum of 5000 epochs
    if (!isFinite(ep) || ep < 1) ep = 1;
    if (ep > 5000) { ep = 5000; if (epochsInput) epochsInput.value = String(ep); }

    // Clamp learning rate to [0.001, 0.1]
    if (!isFinite(lr)) lr = 0.01;
    if (lr < 0.001) { lr = 0.001; if (lrInput) lrInput.value = String(lr); }
    if (lr > 0.1) { lr = 0.1; if (lrInput) lrInput.value = String(lr); }

    // Clamp patience to [10, 500]
    if (!isFinite(pat) || pat < 10) pat = 10;
    if (pat > 500) { pat = 500; }
    if (patienceInput) patienceInput.value = String(pat);

    // Clamp early stopping to [0, 5]
    if (!isFinite(es) || es < 0) es = 0;
    if (es > 5) { es = 5; }
    if (esInput) esInput.value = String(es);

    return {
        learningRate: lr,
        momentum: mom,
        epochs: ep,
        earlyStopping: es,
        patience: pat
    };
}

async function trainModelFromUI() {
    // Remove prediction mesh immediately on Train click
    if (window.predictionMesh && window.scene) {
        try {
            window.scene.remove(window.predictionMesh);
            if (window.predictionMesh.geometry) window.predictionMesh.geometry.dispose();
            if (window.predictionMesh.material) window.predictionMesh.material.dispose();
        } catch (e) {
            console.warn('Error removing prediction mesh at Train click:', e);
        }
        window.predictionMesh = null;
    }
    console.log('Train button clicked');
    const neuronCounts = getNetworkStructure();
    const activation = getActivation();
    const { learningRate, momentum, epochs, patience, earlyStopping } = getLearningParams();
    // Prepare training data
    const points = getPointsData();

    // Display modal and wire up close handlers (idempotent handlers to avoid duplicates)
    const modal = document.getElementById('training-modal');
    const closeBtn = document.getElementById('close-training-modal');
    const trainBtn = document.getElementById('train-btn');
    let trainingTimerStart = null;
    let trainingTimerId = null;
    function startTrainingTimer() {
        const elapsedEl = document.getElementById('training-elapsed');
        if (!elapsedEl) return;
        trainingTimerStart = performance.now();
        const format = (ms) => {
            const totalMs = Math.max(0, ms);
            const totalSec = totalMs / 1000;
            const min = Math.floor(totalSec / 60);
            const sec = Math.floor(totalSec % 60);
            const deci = Math.floor((totalSec - Math.floor(totalSec)) * 10);
            const mm = String(min).padStart(2, '0');
            const ss = String(sec).padStart(2, '0');
            return `${mm}:${ss}.${deci}`;
        };
        // ensure reset to 00:00.0 before start
        elapsedEl.textContent = '00:00.0';
        trainingTimerId = setInterval(() => {
            const now = performance.now();
            const delta = now - trainingTimerStart;
            const el = document.getElementById('training-elapsed');
            if (el) {
                // reuse same formatter
                const totalMs = Math.max(0, delta);
                const totalSec = totalMs / 1000;
                const min = Math.floor(totalSec / 60);
                const sec = Math.floor(totalSec % 60);
                const deci = Math.floor((totalSec - Math.floor(totalSec)) * 10);
                const mm = String(min).padStart(2, '0');
                const ss = String(sec).padStart(2, '0');
                el.textContent = `${mm}:${ss}.${deci}`;
            }
        }, 100);
        if (modal) modal._trainingTimer = trainingTimerId;
    }
    function stopTrainingTimer() {
        if (trainingTimerId) {
            clearInterval(trainingTimerId);
            trainingTimerId = null;
            if (modal) modal._trainingTimer = null;
        }
    }
    if (modal) {
        // Show
        modal.style.display = 'block';
        if (trainBtn) trainBtn.disabled = true;

        // Clear previous handlers if any
        if (closeBtn) closeBtn.onclick = null;
        modal.onclick = null;
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
            modal._escHandler = null;
        }

        // Close when clicking the X
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
                if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
                if (trainBtn) trainBtn.disabled = false;
                // stop timer on manual close
                stopTrainingTimer();
            };
        }

        // Close when clicking outside the dialog content (on overlay)
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
                if (trainBtn) trainBtn.disabled = false;
                // stop timer on manual close
                stopTrainingTimer();
            }
        };

        // Close on Escape key (store handler so we can remove it later)
        modal._escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
                if (trainBtn) trainBtn.disabled = false;
                // stop timer on manual close
                stopTrainingTimer();
            }
        };
        document.addEventListener('keydown', modal._escHandler);

        // Remove any previous training status messages (e.g., Training Complete, warnings)
        const modalBody = document.getElementById('training-modal-body');
        if (modalBody) {
            modalBody.querySelectorAll('.training-status-msg').forEach(el => el.remove());
        }
        // Let the browser paint the modal before heavy work
        await new Promise(requestAnimationFrame);
        // Start the live timer once modal is painted
        startTrainingTimer();
    }

    if (!points.length) {
        // No points - close modal and re-enable button
        if (modal) {
            modal.style.display = 'none';
            if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
        }
        if (trainBtn) trainBtn.disabled = false;
        alert('No training points found. Please add points before training.');
        return;
    }

    // Remove existing prediction mesh while training runs
    if (window.predictionMesh && window.scene) {
        try {
            window.scene.remove(window.predictionMesh);
            if (window.predictionMesh.geometry) window.predictionMesh.geometry.dispose();
            if (window.predictionMesh.material) window.predictionMesh.material.dispose();
        } catch (e) {
            console.warn('Error removing prediction mesh before training:', e);
        }
        window.predictionMesh = null;
    }

    const xs = points.map(pt => [pt.x, pt.z]);
    const ys = points.map(pt => [pt.y]);

    // Reset the training graph when starting a new training run
    if (typeof window.resetLossChart === 'function') {
        try { window.resetLossChart(); } catch (_) {}
    }

    // === Sanity checks: ensure inputs/labels are finite numbers ===
    const isFiniteNumber = (n) => typeof n === 'number' && isFinite(n);
    const badPoint = points.find(pt => !isFiniteNumber(pt.x) || !isFiniteNumber(pt.z) || !isFiniteNumber(pt.y));
    if (badPoint) {
        if (modal) {
            modal.style.display = 'none';
            if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
        }
        if (trainBtn) trainBtn.disabled = false;
        alert('Training aborted: Found non-finite values in data. Please ensure all X, Z, and Y values are valid numbers.');
        return;
    }

    // Wrap heavy work in try/finally so we always cleanup the modal and button state
    let model = null;
    try {
        // === Build model ===
        model = tf.sequential();
        if (neuronCounts.length > 0) {
            model.add(tf.layers.dense({
                units: neuronCounts[0],
                inputShape: [2],
                activation: activation
            }));
            for (let i = 1; i < neuronCounts.length; i++) {
                model.add(tf.layers.dense({
                    units: neuronCounts[i],
                    activation: activation
                }));
            }
            model.add(tf.layers.dense({ units: 1 }));
        } else {
            model.add(tf.layers.dense({ units: 1, inputShape: [2] }));
        }

        // === Pre-load diagnostic ===
        console.log("=== Pre-Load Diagnostic ===");
        if (Array.isArray(window.weights) && Array.isArray(window.biases)) {
            window.weights.forEach((w, idx) => {
                console.log(`Layer ${idx} stored weight shape: [${w.length}, ${w[0]?.length}]`);
                console.log(`Sample weights:`, w.slice(0, 3));
            });
            window.biases.forEach((b, idx) => {
                console.log(`Layer ${idx} stored bias length: ${b.length}`);
                console.log(`Sample biases:`, b.slice(0, 3));
            });
        }

        // === Load stored weights safely ===
        if (Array.isArray(window.weights) && Array.isArray(window.biases)) {
            const layers = model.layers;
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                if (layer.getWeights) {
                    const currentWeights = layer.getWeights();

                    // Transpose stored weights to match TensorFlow's [fan_in, fan_out]
                    let w = window.weights[i] ? tf.transpose(tf.tensor(window.weights[i])) : currentWeights[0];
                    let b = window.biases[i] ? tf.tensor(window.biases[i]) : currentWeights[1];

                    console.log(`Layer ${i} applying weight shape:`, w.shape);
                    console.log(`Layer ${i} applying bias shape:`, b.shape);

                    const weightShapeMatches =
                        w.shape.length === currentWeights[0].shape.length &&
                        w.shape.every((dim, idx) => dim === currentWeights[0].shape[idx]);

                    const biasShapeMatches =
                        b.shape.length === currentWeights[1].shape.length &&
                        b.shape.every((dim, idx) => dim === currentWeights[1].shape[idx]);

                    if (weightShapeMatches && biasShapeMatches) {
                        layer.setWeights([w, b]);
                    } else {
                        alert(`Network weights/biases shape mismatch for layer ${i}. Using default weights.`);
                        console.log("Expected weights:", currentWeights[0].shape, "Biases:", currentWeights[1].shape);
                        console.log("Got weights:", w.shape, "Biases:", b.shape);
                    }
                }
            }
        }

        // === Compile model (create optimizer) ===
        // Use momentum optimizer if momentum > 0, otherwise plain SGD
        const useMomentum = typeof momentum === 'number' && !isNaN(momentum) && momentum > 0;
        const optimizer = useMomentum
            ? tf.train.momentum(learningRate, momentum, false) // set true for Nesterov if desired
            : tf.train.sgd(learningRate);

        // === Train model (manual loop with gradient clipping) ===
        // Early stopping with best-weight restore
        let bestLoss = Infinity;
        let bestEpoch = -1;
        let epochsNoImprovement = 0;
        let bestWeights = null; // Array per layer of [kernel, bias] tensors (cloned)

        function disposeBestWeights() {
            if (bestWeights) {
                try {
                    for (const lw of bestWeights) {
                        if (Array.isArray(lw)) {
                            lw.forEach(t => t && typeof t.dispose === 'function' && t.dispose());
                        }
                    }
                } catch (e) { console.warn('Error disposing bestWeights:', e); }
                bestWeights = null;
            }
        }

        const xsTensor = tf.tensor2d(xs);
        const ysTensor = tf.tensor2d(ys);
        const clipValue = 1.0; // clip-by-value threshold (tune to 0.5–5.0 as needed)
        const minDelta = (typeof earlyStopping === 'number' && isFinite(earlyStopping)) ? earlyStopping : 1e-4; // minimum improvement to reset patience
        let stoppedEarly = false;
        let lastFiniteLoss = null; // track last finite loss
        let stopReason = null; // 'nan-inf' | 'patience' | 'early-threshold' | null

        for (let epoch = 0; epoch < epochs; epoch++) {
            // Compute loss and gradients w.r.t. model variables
            const vg = tf.variableGrads(() => {
                const preds = model.predict(xsTensor);
                const lossTensor = tf.losses.meanSquaredError(ysTensor, preds).mean();
                return lossTensor;
            });

            const loss = vg.value.dataSync()[0];

            // Update loss chart
            if (typeof window.updateLossChart === 'function' && isFinite(loss)) {
                try { window.updateLossChart(epoch, loss); } catch (_) {}
            }
            // Track last finite loss
            if (isFinite(loss)) lastFiniteLoss = loss;

            // NaN/Inf guard
            if (!isFinite(loss)) {
                console.warn('NaN/Inf loss detected at epoch', epoch, '— stopping training.');
                const modalBody = document.getElementById('training-modal-body');
                if (modalBody) {
                    const warn = document.createElement('div');
                    warn.className = 'training-status-msg';
                    warn.style.marginTop = '10px';
                    warn.style.color = '#c0392b';
                    warn.innerHTML = `You have an exploding gradient, try reducing the learning rate and inserting more layers of neurons.` +
                        (lastFiniteLoss != null ? ` <span class="badge bg-secondary ms-2">Last finite loss: ${lastFiniteLoss.toFixed(6)}</span>` : '');
                    modalBody.appendChild(warn);
                }
                stopReason = 'nan-inf';
                // Dispose grads and tensors then break
                vg.value.dispose();
                Object.values(vg.grads).forEach(t => t.dispose());
                break;
            }

            // Early stopping tracking
            if ((bestLoss - loss) > minDelta) {
                bestLoss = loss;
                bestEpoch = epoch + 1;
                epochsNoImprovement = 0;
                // Snapshot current weights (clone) to restore later
                disposeBestWeights();
                bestWeights = model.layers.map(layer => {
                    if (!layer.getWeights) return null;
                    const ws = layer.getWeights();
                    return ws.map(t => t.clone());
                });
            } else {
                epochsNoImprovement += 1;
                const patienceVal = (typeof patience === 'number' && isFinite(patience) && patience > 0) ? patience : 0;
                if (patienceVal > 0 && epochsNoImprovement >= patienceVal) {
                    stoppedEarly = true;
                    stopReason = 'patience';
                    // Dispose current grads and break loop (UI message will be appended at the end)
                    vg.value.dispose();
                    Object.values(vg.grads).forEach(t => t.dispose());
                    break;
                }
                // Optional: if no patience but earlyStopping set, allow immediate threshold-based stop
                if (patienceVal === 0 && minDelta > 0) {
                    stoppedEarly = true;
                    stopReason = 'early-threshold';
                    vg.value.dispose();
                    Object.values(vg.grads).forEach(t => t.dispose());
                    break;
                }
            }

            // Clip gradients and apply update
            const clipped = {};
            for (const name in vg.grads) {
                // Clip-by-value (simpler and robust)
                clipped[name] = tf.clipByValue(vg.grads[name], -clipValue, clipValue);
            }
            optimizer.applyGradients(clipped);

            // Cleanup tensors for this step
            vg.value.dispose();
            Object.values(vg.grads).forEach(t => t.dispose());
            Object.values(clipped).forEach(t => t.dispose());

            // Periodically yield to keep UI responsive
            if (epoch % 10 === 0) {
                await tf.nextFrame();
            }
        }

        xsTensor.dispose();
        ysTensor.dispose();

        // Restore best weights if we captured any snapshot
        if (bestWeights) {
            try {
                for (let i = 0; i < model.layers.length; i++) {
                    if (model.layers[i].setWeights && bestWeights[i]) {
                        model.layers[i].setWeights(bestWeights[i]);
                    }
                }
            } finally {
                disposeBestWeights();
            }
        }
        // Training finished — avoid alerting the user to prevent interruption.
        console.log('Training complete.');

        // === Save weights for drawNetwork (after potential restore) ===
        window.weights = [];
        window.biases = [];
        for (const layer of model.layers) {
            if (layer.getWeights) {
                const weights = layer.getWeights();
                // Transpose back to [fan_out][fan_in] for drawNetwork
                const wArray = tf.transpose(weights[0]).arraySync(); 
                const bArray = weights[1].arraySync();
                window.weights.push(wArray);
                window.biases.push(bArray);

                console.log("Saved Layer weights shape:", wArray.length, "x", wArray[0]?.length, "Bias shape:", bArray.length);
            }
        }

        // === Update modal content to "Training complete" (only add final loss, avoid redundant banners) ===
        if (modal) {
            const modalBody = document.getElementById('training-modal-body');
            if (modalBody) {
                const finalLossDiv = document.createElement('div');
                finalLossDiv.className = 'training-status-msg';
                finalLossDiv.style.marginTop = '6px';
                // Use restored best loss when patience triggered; otherwise show last finite loss
                const finalLossToReport = (stopReason === 'patience' && isFinite(bestLoss)) ? bestLoss : lastFiniteLoss;
                const finalLossText = (typeof finalLossToReport === 'number' && isFinite(finalLossToReport)) ? finalLossToReport.toFixed(6) : 'n/a';
                finalLossDiv.innerHTML = `<span class="badge bg-secondary">Final loss: ${finalLossText}</span>`;
                modalBody.appendChild(finalLossDiv);
            }
        }

        // === Generate prediction mesh for Three.js ===
        if (window.predictionMesh && window.scene) {
            console.log('Removing existing prediction mesh.');
            window.scene.remove(window.predictionMesh);
            window.predictionMesh.geometry.dispose();
            window.predictionMesh.material.dispose();
            window.predictionMesh = null;
        }

        // Use THREE namespace from window, fallback to global if available
        const THREE_NS = (typeof window !== 'undefined' && window.THREE) ? window.THREE : (typeof THREE !== 'undefined' ? THREE : null);

        if (window.scene && THREE_NS) {
            console.log('Generating new prediction mesh with batching.');
            const step = 0.5; // finer grid for a smoother surface
            const xMin = -25, xMax = 25, zMin = -25, zMax = 25;
            const xCount = Math.floor((xMax - xMin) / step) + 1;
            const zCount = Math.floor((zMax - zMin) / step) + 1;
            const geometry = new THREE_NS.BufferGeometry();

            // Prepare batch input for predictions
            const batchInputs = [];
            for (let xi = 0; xi < xCount; xi++) {
                for (let zi = 0; zi < zCount; zi++) {
                    const x = xMin + xi * step;
                    const z = zMin + zi * step;
                    batchInputs.push([x, z]);
                }
            }

            // Perform batch prediction (single large batch)
            const batchTensor = tf.tensor2d(batchInputs);
            const batchOutputs = await model.predict(batchTensor).array();
            batchTensor.dispose();

            const vertCount = xCount * zCount;
            const positions = new Float32Array(vertCount * 3);
            // const colors = new Float32Array(vertCount * 3); // no longer needed when using solid color material

            // Fill typed arrays
            for (let i = 0; i < vertCount; i++) {
                const idx3 = i * 3;
                const x = batchInputs[i][0];
                const z = batchInputs[i][1];
                const y = batchOutputs[i][0];
                positions[idx3] = x;
                positions[idx3 + 1] = y;
                positions[idx3 + 2] = z;
                // kept for reference when vertex colors are desired
                // colors[idx3] = 0.0; colors[idx3 + 1] = 1.0; colors[idx3 + 2] = 0.0;
            }

            geometry.setAttribute('position', new THREE_NS.Float32BufferAttribute(positions, 3));
            // geometry.setAttribute('color', new THREE_NS.Float32BufferAttribute(colors, 3));

            const indices = [];
            for (let xi = 0; xi < xCount - 1; xi++) {
                for (let zi = 0; zi < zCount - 1; zi++) {
                    const a = xi * zCount + zi;
                    const b = (xi + 1) * zCount + zi;
                    const c = (xi + 1) * zCount + (zi + 1);
                    const d = xi * zCount + (zi + 1);
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                }
            }
            geometry.setIndex(indices);
            // MeshBasicMaterial doesn't use normals; skip computing to save time
            // geometry.computeVertexNormals();
            try { geometry.computeBoundingSphere(); } catch (_) {}

            // Start with a solid color so we can cycle colours easily; default from global selection
            const material = new THREE_NS.MeshBasicMaterial({
                color: (window.meshColors && window.meshColors[window.meshColorIndex]) ? window.meshColors[window.meshColorIndex] : 0x00ff00,
                side: THREE_NS.DoubleSide,
                transparent: true,
                opacity: 0.6
            });
            const mesh = new THREE_NS.Mesh(geometry, material);
            mesh.name = 'predictionMesh';
            mesh.frustumCulled = false;
            window.scene.add(mesh);
            window.predictionMesh = mesh;
            // Apply any pending style (shadows or updated colour)
            if (typeof window.applyPredictionMeshStyle === 'function') {
                try { window.applyPredictionMeshStyle(); } catch (_) {}
            }

            console.log('Prediction mesh added to scene.');

            // Log camera position and target
            if (window.camera) {
                console.log('Camera position:', window.camera.position);
                console.log('Camera target:', window.controls.target);
            }
        }

        // === Append unified outcome message at the bottom ===
        if (modal) {
            const modalBody = document.getElementById('training-modal-body');
            if (modalBody) {
                const reasonDiv = document.createElement('div');
                reasonDiv.className = 'training-status-msg';
                reasonDiv.style.marginTop = '12px';
                reasonDiv.style.borderTop = '1px solid #ddd';
                reasonDiv.style.paddingTop = '8px';
                let msg = '';
                if (stopReason === 'patience') {
                    const be = (typeof bestEpoch === 'number' && bestEpoch > 0) ? bestEpoch : 'n/a';
                    msg = `<span class="badge bg-warning text-dark">Training stopped early (patience); restored to epoch ${be}</span>`;
                } else if (stopReason === 'early-threshold') {
                    msg = '<span class="badge bg-warning text-dark">Training stopped early (early stopping threshold)</span>';
                } else if (stopReason === 'nan-inf') {
                    msg = '<span class="badge bg-danger">Training stopped due to unstable loss (NaN/Inf)</span>';
                } else {
                    msg = '<span class="badge bg-success">Training completed: epoch limit reached</span>';
                }
                reasonDiv.innerHTML = msg;
                modalBody.appendChild(reasonDiv);
            }
        }
    } catch (err) {
        console.error('Training error:', err);
        alert('Training failed: ' + (err && err.message ? err.message : err));
    } finally {
        // Ensure button is re-enabled, but do not hide the modal
        if (trainBtn) trainBtn.disabled = false;
        // Stop the timer when training ends
        stopTrainingTimer();
    }

    // === Redraw network ===
    if (typeof window.redrawNetwork === 'function') {
        window.redrawNetwork();
    }

    // Removed duplicate prediction mesh generation block that re-rendered the mesh a second time.
}

// Attach event listener to train button
document.getElementById('train-btn').addEventListener('click', trainModelFromUI);
