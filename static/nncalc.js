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
    return {
        learningRate: parseFloat(document.getElementById('learning-rate').value),
        momentum: parseFloat(document.getElementById('momentum').value),
        epochs: parseInt(document.getElementById('epochs').value),
        earlyStopping: parseFloat(document.getElementById('earlystopping').value),
        patience: parseInt((document.getElementById('patience') && document.getElementById('patience').value) || 50)
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
    const { learningRate, momentum, epochs, patience } = getLearningParams();
    // Prepare training data
    const points = getPointsData();

    // Display modal and wire up close handlers (idempotent handlers to avoid duplicates)
    const modal = document.getElementById('training-modal');
    const closeBtn = document.getElementById('close-training-modal');
    const trainBtn = document.getElementById('train-btn');
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
            };
        }

        // Close when clicking outside the dialog content (on overlay)
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
                if (trainBtn) trainBtn.disabled = false;
            }
        };

        // Close on Escape key (store handler so we can remove it later)
        modal._escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
                if (trainBtn) trainBtn.disabled = false;
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
        const minDelta = 1e-4; // minimum improvement to reset patience
        let stoppedEarly = false;
        let lastFiniteLoss = null; // track last finite loss
        let stopReason = null; // 'nan-inf' | 'early' | null

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
                try { window.updateLossChart(epoch + 1, loss); } catch (_) {}
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
                const patienceVal = (typeof patience === 'number' && isFinite(patience) && patience > 0) ? patience : 50;
                if (epochsNoImprovement >= patienceVal) {
                    stoppedEarly = true;
                    stopReason = 'early';
                    const modalBody = document.getElementById('training-modal-body');
                    if (modalBody) {
                        const info = document.createElement('div');
                        info.className = 'training-status-msg';
                        info.style.marginTop = '10px';
                        const stoppedEpoch = epoch + 1;
                        info.innerHTML = `
                            <span class="badge bg-warning text-dark">Stopped early at epoch ${stoppedEpoch}</span>
                            <span class="badge bg-info text-dark ms-2">Restored best epoch ${bestEpoch}</span>
                            <span class="badge bg-secondary ms-2">Final loss: ${lastFiniteLoss != null ? lastFiniteLoss.toFixed(6) : 'n/a'}</span>
                            <span class="badge bg-secondary ms-2">Best loss: ${isFinite(bestLoss) ? bestLoss.toFixed(6) : 'n/a'}</span>
                        `;
                        modalBody.appendChild(info);
                    }
                    // Dispose current grads and break loop
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

        // === Update modal content to "Training complete" (only on normal completion) ===
        if (modal && !stoppedEarly && stopReason === null) {
            const modalBody = document.getElementById('training-modal-body');
            if (modalBody) {
                // When training is complete, add a div below the existing content
                const trainingCompleteDiv = document.createElement('div');
                trainingCompleteDiv.className = 'training-status-msg';
                trainingCompleteDiv.style.marginTop = '10px';
                trainingCompleteDiv.innerHTML = '<span class="badge bg-success">Training Complete</span>';
                document.getElementById('training-modal-body').appendChild(trainingCompleteDiv);

                // Also show final loss
                const finalLossDiv = document.createElement('div');
                finalLossDiv.className = 'training-status-msg';
                finalLossDiv.style.marginTop = '6px';
                finalLossDiv.innerHTML = `<span class="badge bg-secondary">Final loss: ${typeof lastFiniteLoss === 'number' ? lastFiniteLoss.toFixed(6) : 'n/a'}</span>`;
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

        if (window.scene && window.THREE) {
            console.log('Generating new prediction mesh with batching.');
            const step = 1;
            const xMin = -25, xMax = 25, zMin = -25, zMax = 25;
            const xCount = Math.floor((xMax - xMin) / step) + 1;
            const zCount = Math.floor((zMax - zMin) / step) + 1;
            const geometry = new window.THREE.BufferGeometry();
            const vertices = [];
            const colors = [];

            // Prepare batch input for predictions
            const batchInputs = [];
            for (let xi = 0; xi < xCount; xi++) {
                for (let zi = 0; zi < zCount; zi++) {
                    const x = xMin + xi * step;
                    const z = zMin + zi * step;
                    if (x > -26 && x < 26 && z > -26 && z < 26) {
                        batchInputs.push([x, z]);
                    }
                }
            }

            // Perform batch prediction
            const batchTensor = tf.tensor2d(batchInputs);
            const batchOutputs = await model.predict(batchTensor).array();
            batchTensor.dispose();

            // Process predictions
            for (let i = 0; i < batchInputs.length; i++) {
                const [x, z] = batchInputs[i];
                const y = batchOutputs[i][0];
                vertices.push(x, y, z);
                colors.push(0, 1, 0); // Bright green color for better visibility
            }

            console.log('Vertices count:', vertices.length / 3);

            geometry.setAttribute('position', new window.THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('color', new window.THREE.Float32BufferAttribute(colors, 3));

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
            geometry.computeVertexNormals();

            const material = new window.THREE.MeshStandardMaterial({
                vertexColors: true,
                side: window.THREE.DoubleSide,
                transparent: false, // Disable transparency for better visibility
                opacity: 1.0 // Fully opaque
            });
            const mesh = new window.THREE.Mesh(geometry, material);
            mesh.name = 'predictionMesh';
            window.scene.add(mesh);
            window.predictionMesh = mesh;

            console.log('Prediction mesh added to scene.');

            // Log camera position and target
            if (window.camera) {
                console.log('Camera position:', window.camera.position);
                console.log('Camera target:', window.controls.target);
            }
        }
    } catch (err) {
        console.error('Training error:', err);
        alert('Training failed: ' + (err && err.message ? err.message : err));
    } finally {
        // Ensure button is re-enabled, but do not hide the modal
        if (trainBtn) trainBtn.disabled = false;
    }

    // === Redraw network ===
    if (typeof window.redrawNetwork === 'function') {
        window.redrawNetwork();
    }

    // Removed duplicate prediction mesh generation block that re-rendered the mesh a second time.
}

// Attach event listener to train button
document.getElementById('train-btn').addEventListener('click', trainModelFromUI);
